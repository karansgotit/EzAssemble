"use client";

// TEMPORARY stand-in for <AssemblyScene> until AJI-02 lands. It takes the same props (CONTRACTS §7) and
// reports progress on a timer, so the player's wiring can be built and tested without the 3D scene.
import { useEffect, useRef, useState } from "react";
import type { AssemblySceneProps } from "./tempContracts";
import styles from "./StepPlayer.module.css";

const DURATION_S = 3;

export function ScenePlaceholder(props: AssemblySceneProps) {
  const { manual, stepIndex, playKey, playing, speed, scrubT, showTrap, onProgress, onDone } = props;
  const t = useRef(0);
  const [shown, setShown] = useState(0);
  const callbacks = useRef({ onProgress, onDone });
  useEffect(() => {
    callbacks.current = { onProgress, onDone };
  });

  useEffect(() => {
    t.current = 0;
    setShown(0);
  }, [playKey, stepIndex]);

  useEffect(() => {
    if (scrubT === null) return;
    t.current = scrubT;
    setShown(scrubT);
  }, [scrubT]);

  useEffect(() => {
    if (!playing || scrubT !== null) return;
    let frame = 0;
    let previous = performance.now();
    function tick(now: number) {
      t.current = Math.min(t.current + ((now - previous) / 1000 / DURATION_S) * speed, 1);
      previous = now;
      setShown(t.current);
      callbacks.current.onProgress(t.current);
      if (t.current >= 1) callbacks.current.onDone();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playKey, stepIndex, playing, speed, scrubT]);

  const step = manual.steps[stepIndex];
  return (
    <div className={styles.placeholder} data-testid="scene-placeholder" data-show-trap={showTrap}>
      <p>3D scene placeholder · step {step?.stepNumber}</p>
      <div className={styles.placeholderTrack}>
        <div className={styles.placeholderBlock} style={{ left: `${shown * 100}%` }} />
      </div>
      {showTrap && step?.trap && (
        <p className={styles.placeholderTrap}>
          ✗ {step.trap.source === "manual" ? "From the manual" : "Possible mistake"} → ✓ {step.trap.hint}
        </p>
      )}
    </div>
  );
}
