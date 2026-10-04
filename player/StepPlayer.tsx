"use client";

import { type ComponentType, useReducer, useRef, useState } from "react";
import { ConfidenceBanner } from "./ConfidenceBanner";
import { DiagramPanel } from "./DiagramPanel";
import { PartsTray } from "./PartsTray";
import { PlaybackBar } from "./PlaybackBar";
import { initialPlayback, playbackReducer } from "./playback";
import { ScenePlaceholder } from "./ScenePlaceholder";
import { StepNav } from "./StepNav";
import { clampStepIndex, hasAnimation, partsForStep, shouldAutoplayTrap, trapButtonLabel } from "./stepView";
import type { AssemblySceneProps, SceneManual } from "./tempContracts";
import { usePlayerKeys } from "./usePlayerKeys";
import styles from "./StepPlayer.module.css";

type Props = {
  manual: SceneManual;
  mode: "library" | "processing";
  // The real <AssemblyScene> (loaded with next/dynamic, ssr: false) is passed in once AJI-02 lands.
  Scene?: ComponentType<AssemblySceneProps>;
};

export function StepPlayer({ manual, mode, Scene = ScenePlaceholder }: Props) {
  const [state, dispatch] = useReducer(playbackReducer, initialPlayback);
  const total = manual.steps.length;
  const first = manual.steps[0];
  const seenTraps = useRef(new Set<number>(first ? [first.stepNumber] : []));
  const [showTrap, setShowTrap] = useState(() => first !== undefined && shouldAutoplayTrap(first, new Set()));
  const [sceneKey, setSceneKey] = useState(0);

  const index = clampStepIndex(state.stepIndex, total);
  const step = manual.steps[index];
  const animated = step !== undefined && hasAnimation(step);

  function open(target: number) {
    const next = clampStepIndex(target, total);
    const nextStep = manual.steps[next];
    if (next === index || !nextStep) return;
    setShowTrap(shouldAutoplayTrap(nextStep, seenTraps.current));
    seenTraps.current.add(nextStep.stepNumber);
    dispatch({ type: "goTo", index: next, total });
  }
  function replay(withTrap = false) {
    setShowTrap(withTrap);
    dispatch({ type: "replay" });
  }
  function toggle() {
    if (state.progress >= 1) setShowTrap(false); // pressing play on a finished step replays it without the ghost
    dispatch({ type: "toggle" });
  }
  function resetView() {
    // The scene contract has no "reset camera" prop, so remount it; that also restarts the step.
    setSceneKey((key) => key + 1);
    replay();
  }

  usePlayerKeys({
    onPrev: () => open(index - 1),
    onNext: () => open(index + 1),
    onToggle: animated ? toggle : undefined,
    onReplay: animated ? () => replay() : undefined,
  });

  if (!step) {
    return <p className={styles.empty}>{mode === "processing" ? "Reading the manual…" : "This manual has no steps."}</p>;
  }

  const trapLabel = animated ? trapButtonLabel(step.trap) : null;
  const isLast = index === total - 1;

  return (
    <div className={styles.player}>
      <header className={styles.header}>
        <h1>{manual.title}</h1>
        <p>
          Step {index + 1} of {total}
          {mode === "processing" && " · more steps are still being read"}
        </p>
      </header>

      {step.kind === "assembly" && (
        <div className={styles.workspace}>
          <aside className={styles.reference}>
            <DiagramPanel key={step.crop} src={step.crop} stepNumber={step.stepNumber} />
            <PartsTray items={partsForStep(manual.parts, step)} />
          </aside>
          <section className={styles.scene} aria-label="3D view of this step">
            <Scene
              key={sceneKey}
              manual={manual}
              stepIndex={index}
              playKey={state.playKey}
              playing={state.playing}
              speed={state.speed}
              scrubT={state.scrubT}
              showTrap={showTrap}
              onProgress={(t) => dispatch({ type: "progress", t })}
              onDone={() => dispatch({ type: "done" })}
            />
            <button type="button" className={styles.resetView} onClick={resetView}>
              Reset view
            </button>
          </section>
        </div>
      )}
      {(step.kind === "info" || step.kind === "failed") && (
        <DiagramPanel key={step.crop} src={step.crop} stepNumber={step.stepNumber} large />
      )}
      {step.kind === "subassembly" && (
        <section className={styles.card}>
          <h2>Assembled separately</h2>
          <p>{step.instruction}</p>
          <button type="button" className={styles.primary} disabled={isLast} onClick={() => open(index + 1)}>
            Continue
          </button>
        </section>
      )}

      <section className={styles.instruction}>
        {step.kind !== "subassembly" && (
          <>
            {step.kind !== "failed" && <ConfidenceBanner confidence={step.confidence} />}
            <div className={styles.instructionRow}>
              <p className={step.kind === "failed" ? styles.failed : undefined}>{step.instruction}</p>
              {trapLabel && (
                <button type="button" className={styles.trapButton} onClick={() => replay(true)}>
                  ⚠ {trapLabel}
                </button>
              )}
            </div>
          </>
        )}
        {animated && (
          <PlaybackBar
            playing={state.playing}
            progress={state.progress}
            speed={state.speed}
            onToggle={toggle}
            onReplay={() => replay()}
            onSpeed={(speed) => dispatch({ type: "speed", speed })}
            onScrub={(t) => dispatch({ type: "scrub", t })}
          />
        )}
        <StepNav index={index} labels={manual.steps.map((s) => String(s.stepNumber))} onChange={open} />
      </section>
    </div>
  );
}
