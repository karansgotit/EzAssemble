"use client";

// Dev-only page for SMI-03: the player controls driven by a stand-in for <AssemblyScene>.
// The stand-in takes the same playback props as the real scene (CONTRACTS §7), so this wiring carries over.
import { useEffect, useReducer, useRef } from "react";
import { PlaybackBar } from "@/player/PlaybackBar";
import { initialPlayback, playbackReducer, type Speed } from "@/player/playback";
import { StepNav } from "@/player/StepNav";
import { usePlayerKeys } from "@/player/usePlayerKeys";
import styles from "./page.module.css";

const STEP_LABELS = Array.from({ length: 19 }, (_, i) => String(i + 1));
const FAKE_DURATION_S = 3;

type FakeSceneProps = {
  playKey: number;
  playing: boolean;
  speed: Speed;
  scrubT: number | null;
  onProgress: (t: number) => void;
  onDone: () => void;
};

function FakeScene({ playKey, playing, speed, scrubT, onProgress, onDone }: FakeSceneProps) {
  const t = useRef(0);
  const callbacks = useRef({ onProgress, onDone });
  useEffect(() => {
    callbacks.current = { onProgress, onDone };
  });

  useEffect(() => {
    t.current = 0;
  }, [playKey]);

  useEffect(() => {
    if (scrubT !== null) t.current = scrubT;
  }, [scrubT]);

  useEffect(() => {
    if (!playing || scrubT !== null) return;
    let frame = 0;
    let previous = performance.now();
    function tick(now: number) {
      t.current = Math.min(t.current + ((now - previous) / 1000 / FAKE_DURATION_S) * speed, 1);
      previous = now;
      callbacks.current.onProgress(t.current);
      if (t.current >= 1) callbacks.current.onDone();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playKey, playing, speed, scrubT]);

  return null;
}

export default function PlayerDevPage() {
  const [state, dispatch] = useReducer(playbackReducer, initialPlayback);
  const goTo = (index: number) => dispatch({ type: "goTo", index, total: STEP_LABELS.length });

  usePlayerKeys({
    onPrev: () => goTo(state.stepIndex - 1),
    onNext: () => goTo(state.stepIndex + 1),
    onToggle: () => dispatch({ type: "toggle" }),
    onReplay: () => dispatch({ type: "replay" }),
  });

  return (
    <main className={styles.page}>
      <h1>Player controls</h1>
      <p>Keyboard: ← → change step · Space play/pause · R replay</p>

      <div className={styles.stage} data-testid="stage">
        <FakeScene
          playKey={state.playKey}
          playing={state.playing}
          speed={state.speed}
          scrubT={state.scrubT}
          onProgress={(t) => dispatch({ type: "progress", t })}
          onDone={() => dispatch({ type: "done" })}
        />
        <strong>Step {STEP_LABELS[state.stepIndex]}</strong>
        <div className={styles.track}>
          <div className={styles.block} style={{ left: `${state.progress * 100}%` }} />
        </div>
        <code data-testid="state">{JSON.stringify(state)}</code>
      </div>

      <PlaybackBar
        playing={state.playing}
        progress={state.progress}
        speed={state.speed}
        onToggle={() => dispatch({ type: "toggle" })}
        onReplay={() => dispatch({ type: "replay" })}
        onSpeed={(speed) => dispatch({ type: "speed", speed })}
        onScrub={(t) => dispatch({ type: "scrub", t })}
      />
      <StepNav index={state.stepIndex} labels={STEP_LABELS} onChange={goTo} />
    </main>
  );
}
