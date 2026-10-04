"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useReducer, useRef, useState } from "react";
import { ConfidenceBanner } from "./ConfidenceBanner";
import { DiagramPanel } from "./DiagramPanel";
import { PartsTray } from "./PartsTray";
import { initialPlayback, playbackReducer, SPEEDS } from "./playback";
import { StepNav } from "./StepNav";
import { clampStepIndex, hasAnimation, partsForStep, shouldAutoplayTrap, stepMarkers, trapButtonLabel } from "./stepView";
import type { SceneManual } from "@/schema";
import { usePlayerKeys } from "./usePlayerKeys";
import styles from "./StepPlayer.module.css";

// The player never imports three.js directly: the scene is loaded in the browser only (CONTRACTS §7).
const Scene = dynamic(() => import("@/scene/AssemblyScene").then((m) => m.AssemblyScene), { ssr: false });

// The scene reports its progress; with no scrubber, nothing here needs it.
const ignore = () => {};

type Props = {
  manual: SceneManual;
  mode: "library" | "processing";
  back?: ReactNode; // the way out, shown top left: a link to the manuals, or "upload another"
};

export function StepPlayer({ manual, mode, back }: Props) {
  const [state, dispatch] = useReducer(playbackReducer, initialPlayback);
  const total = manual.steps.length;
  const first = manual.steps[0];
  const seenTraps = useRef(new Set<number>(first ? [first.stepNumber] : []));
  const [showTrap, setShowTrap] = useState(() => first !== undefined && shouldAutoplayTrap(first, new Set()));
  const [sceneKey, setSceneKey] = useState(0);
  const [finished, setFinished] = useState(false);

  // The 3D view reads its colours once, when it mounts. A theme change remounts it so it picks up the new ones.
  useEffect(() => {
    const onTheme = () => setSceneKey((key) => key + 1);
    window.addEventListener("ezassemble:theme", onTheme);
    return () => window.removeEventListener("ezassemble:theme", onTheme);
  }, []);

  const index = clampStepIndex(state.stepIndex, total);
  const step = manual.steps[index];
  const animated = step !== undefined && hasAnimation(step) && !finished;

  function open(target: number) {
    const next = clampStepIndex(target, total);
    const nextStep = manual.steps[next];
    setFinished(false);
    if (next === index || !nextStep) return;
    setShowTrap(shouldAutoplayTrap(nextStep, seenTraps.current));
    seenTraps.current.add(nextStep.stepNumber);
    dispatch({ type: "goTo", index: next, total });
  }
  function replay(withTrap = false) {
    setShowTrap(withTrap);
    dispatch({ type: "replay" });
  }
  function resetView() {
    // The scene contract has no "reset camera" prop, so remount it; that also restarts the step.
    setSceneKey((key) => key + 1);
    replay();
  }

  usePlayerKeys({
    onPrev: () => open(finished ? index : index - 1),
    onNext: () => open(index + 1),
    onToggle: animated ? () => replay() : undefined, // Space replays: the animation has no pause
    onReplay: animated ? () => replay() : undefined,
  });

  const top = (
    <header className={styles.top}>
      <div className={styles.crumb}>
        {back}
        <span className={styles.title}>{manual.title}</span>
      </div>
      {step && !finished && (
        <p className={styles.position}>
          Step <b>{index + 1}</b> of {total}
          {mode === "processing" && " · more steps are still being read"}
        </p>
      )}
    </header>
  );

  if (!step) {
    return (
      <div className={styles.player}>
        {top}
        <p className={styles.empty}>{mode === "processing" ? "Reading the manual…" : "This manual has no steps."}</p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className={styles.player}>
        {top}
        <section className={styles.finished}>
          <span className={styles.numeral} aria-hidden="true">
            ✓
          </span>
          <div className={styles.say}>
            <h1 className={styles.sentence}>Built.</h1>
            <p className={styles.finishedLine}>
              All {total} {total === 1 ? "step" : "steps"} done.
            </p>
            <div className={styles.finishedActions}>
              <button type="button" className="btn btn-lg" onClick={() => open(0)}>
                Go through the steps again
              </button>
              {back}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const trapLabel = animated ? trapButtonLabel(step.trap) : null;
  const isLast = index === total - 1;

  return (
    <div className={styles.player}>
      {top}

      {/* The animation is what the eye lands on. The printed drawing sits beside it, smaller, for comparison. */}
      {step.kind === "assembly" && (
        <div className={styles.stage}>
          <section className={styles.scene} aria-label="3D view of this step">
            <Scene
              key={sceneKey}
              manual={manual}
              stepIndex={index}
              playKey={state.playKey}
              playing
              speed={state.speed}
              scrubT={null}
              showTrap={showTrap}
              onProgress={ignore}
              onDone={ignore}
            />
            <div className={styles.sceneTools}>
              <div className={styles.speeds} role="group" aria-label="Animation speed">
                {SPEEDS.map((option) => (
                  <button type="button" key={option} aria-pressed={option === state.speed} onClick={() => dispatch({ type: "speed", speed: option })}>
                    {option}×
                  </button>
                ))}
              </div>
              <button type="button" className={styles.tool} onClick={resetView}>
                Reset view
              </button>
            </div>
          </section>
          <aside className={styles.reference}>
            <DiagramPanel key={step.crop} src={step.crop} stepNumber={step.stepNumber} />
            <PartsTray items={partsForStep(manual.parts, step)} />
          </aside>
        </div>
      )}
      {(step.kind === "info" || step.kind === "failed") && (
        <div className={styles.sheetOnly}>
          <DiagramPanel key={step.crop} src={step.crop} stepNumber={step.stepNumber} large />
        </div>
      )}

      {/* The manual's own step number, and the sentence the manual never had. */}
      <section className={styles.announce} key={index} aria-live="polite" data-alone={step.kind === "subassembly"}>
        <span className={styles.numeral} aria-hidden="true">
          {step.stepNumber}
        </span>
        <div className={styles.say}>
          <h1 className={styles.sentence}>{step.instruction}</h1>
          {step.kind === "assembly" && <ConfidenceBanner confidence={step.confidence} />}
        </div>
        <div className={styles.actions}>
          {trapLabel && (
            <button type="button" className={styles.mistake} onClick={() => replay(true)}>
              <span aria-hidden="true">✗</span> {trapLabel}
            </button>
          )}
          {animated && (
            <button type="button" className="btn btn-lg" onClick={() => replay()}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 3-6.7" />
                <path d="M3 4v5h5" />
              </svg>
              Replay
            </button>
          )}
          {step.kind === "subassembly" && (
            <button type="button" className="btn btn-primary btn-lg" disabled={isLast} onClick={() => open(index + 1)}>
              Continue
            </button>
          )}
        </div>
      </section>

      <footer className={styles.controls}>
        <StepNav index={index} markers={stepMarkers(manual.steps)} onChange={open} onFinish={mode === "library" ? () => setFinished(true) : undefined} />
      </footer>
    </div>
  );
}
