"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { mockedRoutes } from "@/client/api";
import { jpegDataUrl } from "@/client/canvas";
import { type Crop, type ProcessEvent, processManual } from "@/client/processManual";
import { idFromTitle, INTERIM_PRODUCT_SIZE_CM, overallProgress, stageLabel, titleFromFileName } from "@/client/uploadForm";
import { StepPlayer } from "@/player/StepPlayer";
import { buildSceneManual } from "@/scene/buildSceneManual";
import type { SavedManual, SceneManual } from "@/schema";
import { ProgressView } from "./ProgressView";
import { SaveToLibrary } from "./SaveToLibrary";
import { UploadForm } from "./UploadForm";
import styles from "./upload.module.css";

type Run = {
  title: string;
  running: boolean;
  status: string;
  fraction: number;
  notice: string | null;
  manual: SavedManual | null;
  totalSteps: number | null;
};

/** An uploaded manual's diagrams only exist in memory, so the player gets them as data URLs. */
function toSceneManual(saved: SavedManual, crops: Crop[]): SceneManual {
  const urls = new Map(crops.map((crop) => [crop.name, jpegDataUrl(crop.base64)]));
  const { manual } = buildSceneManual(saved, "");
  return { ...manual, steps: manual.steps.map((step) => (step.crop ? { ...step, crop: urls.get(step.crop.split("/").pop() ?? "") } : step)) };
}

/** "/upload": choose a PDF, watch it being read, then land in the player (FR-10, FR-17, FR-20). */
export default function UploadPage() {
  const [run, setRun] = useState<Run | null>(null);
  const [crops, setCrops] = useState<Crop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const controller = useRef<AbortController | null>(null);

  const scene = useMemo(() => (run?.manual && playerOpen ? toSceneManual(run.manual, crops) : null), [run?.manual, crops, playerOpen]);

  function start(file: File) {
    const abort = new AbortController();
    controller.current = abort;
    const title = titleFromFileName(file.name);
    setError(null);
    setCrops([]);
    setPlayerOpen(false);
    setRun({ title, running: true, status: stageLabel("rasterize", null), fraction: 0, notice: null, manual: null, totalSteps: null });

    let stage: Extract<ProcessEvent, { type: "stage" }>["stage"] = "rasterize";
    const update = (patch: Partial<Run>) => setRun((current) => (current ? { ...current, ...patch } : current));
    const onEvent = (event: ProcessEvent) => {
      if (abort.signal.aborted && event.type !== "manual") return; // keep "Cancelling…" on screen
      if (event.type === "stage") {
        if (event.stage === "index" && event.detail) update({ notice: event.detail });
        if (event.stage !== stage) update({ status: stageLabel(event.stage, null), fraction: overallProgress(event.stage, null) });
        stage = event.stage;
      } else if (event.type === "progress") {
        update({ status: stageLabel(stage, event), fraction: overallProgress(stage, event), ...(stage === "steps" && { totalSteps: event.total }) });
      } else if (event.type === "manual") {
        update({ manual: event.manual });
      } else if (event.type === "crops") {
        setCrops(event.crops);
      }
    };

    const input = { file, title, id: idFromTitle(title), productSizeCm: INTERIM_PRODUCT_SIZE_CM };
    processManual(input, onEvent, undefined, { signal: abort.signal })
      .then(() => {
        update({ running: false, status: stageLabel("done", null), fraction: 1 });
        setPlayerOpen(true); // the manual is ready: go straight to it
      })
      .catch((problem: unknown) => {
        const message = problem instanceof Error ? problem.message : "Something went wrong while reading the manual.";
        // Keep what was already read on screen; with nothing to show, go back to the drop zone.
        setRun((current) => (current?.manual ? { ...current, running: false, status: message } : null));
        setError(message === "Cancelled." ? null : message);
      });
  }

  function cancel() {
    controller.current?.abort();
    // The request in flight has to return before the run ends; say so straight away.
    setRun((current) => (current?.running ? { ...current, status: "Cancelling…" } : current));
  }

  function startOver() {
    setPlayerOpen(false);
    setRun(null);
  }

  // Development only: routes that aren't built yet were answered from saved KALLAX data, not by the AI.
  const mocked = run ? mockedRoutes() : [];
  const devNote = mocked.length > 0 && (
    <p className={styles.devNote} role="note">
      Development: {mocked.join(", ")} {mocked.length === 1 ? "is" : "are"} not built yet, so {mocked.length === 1 ? "it was" : "they were"} answered from saved KALLAX data, not by the AI.
    </p>
  );

  if (run && scene) {
    return (
      <>
        <div className={styles.playerBar}>
          <button type="button" onClick={startOver}>
            ← Upload another manual
          </button>
          {!run.running && run.manual && <SaveToLibrary manual={run.manual} crops={crops} />}
          {devNote}
        </div>
        <StepPlayer manual={scene} mode="library" />
      </>
    );
  }

  return (
    <main className={styles.page}>
      <Link href="/">← Library</Link>
      <h1>Upload a manual</h1>
      {devNote}
      {run ? (
        <ProgressView {...run} onCancel={cancel} onOpenPlayer={() => setPlayerOpen(true)} onStartOver={startOver} />
      ) : (
        <UploadForm onStart={start} lastError={error} />
      )}
    </main>
  );
}
