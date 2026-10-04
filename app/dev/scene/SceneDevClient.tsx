"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { SceneManual } from "@/scene/types";

const AssemblyScene = dynamic(() => import("@/scene/AssemblyScene").then((m) => m.AssemblyScene), { ssr: false });

const SPEEDS = [0.5, 1, 2] as const;

// Bare controls for exercising <AssemblyScene> on its own. The real player is player/StepPlayer.
export function SceneDevClient({ manual, startStep = 1, startT = null }: { manual: SceneManual; startStep?: number; startT?: number | null }) {
  const [stepIndex, setStepIndex] = useState(startStep - 1);
  const [playKey, setPlayKey] = useState(0);
  const [playing, setPlaying] = useState(startT === null);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [scrubT, setScrubT] = useState<number | null>(startT);
  const [progress, setProgress] = useState(startT ?? 0);
  // A fixed moment is a moment of the step's own motion, so the ghost is left out of it.
  const [showTrap, setShowTrap] = useState(startT === null);
  const step = manual.steps[stepIndex];

  const restart = (index: number, trap = true) => {
    setShowTrap(trap);
    setStepIndex(Math.max(0, Math.min(manual.steps.length - 1, index)));
    setPlayKey((k) => k + 1);
    setScrubT(null);
    setProgress(0);
    setPlaying(true);
  };

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <AssemblyScene
          manual={manual}
          stepIndex={stepIndex}
          playKey={playKey}
          playing={playing}
          speed={speed}
          scrubT={scrubT}
          showTrap={showTrap}
          onProgress={setProgress}
          onDone={() => setPlaying(false)}
        />
      </div>
      <div style={{ padding: "0.75rem 1rem", borderTop: "1px solid #ddd" }}>
        <p style={{ margin: "0 0 0.5rem" }}>
          <strong>
            {manual.title} · step {step.stepNumber} of {manual.steps.length} ({step.kind})
          </strong>{" "}
          {step.instruction}
        </p>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => restart(stepIndex - 1)} disabled={stepIndex === 0}>
            Previous
          </button>
          <button onClick={() => restart(stepIndex + 1)} disabled={stepIndex === manual.steps.length - 1}>
            Next
          </button>
          <button onClick={() => restart(stepIndex, false)}>Replay</button>
          {step.trap && <button onClick={() => restart(stepIndex)}>Show mistake ({step.trap.source})</button>}
          <button
            onClick={() => {
              setScrubT(null);
              setPlaying((p) => !p);
            }}
          >
            {playing ? "Pause" : "Play"}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} onClick={() => setSpeed(s)} aria-pressed={s === speed}>
              {s}×
            </button>
          ))}
          <input
            aria-label="Animation progress"
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(event) => {
              const t = Number(event.target.value);
              setScrubT(t);
              setProgress(t);
              setPlaying(false);
            }}
            style={{ flex: 1, minWidth: "8rem" }}
          />
        </div>
      </div>
    </main>
  );
}
