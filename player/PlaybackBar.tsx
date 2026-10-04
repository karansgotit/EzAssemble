"use client";

import { SPEEDS, type Speed } from "./playback";
import styles from "./PlaybackBar.module.css";

type Props = {
  playing: boolean;
  progress: number; // 0..1
  speed: Speed;
  onToggle: () => void;
  onReplay: () => void;
  onSpeed: (speed: Speed) => void;
  onScrub: (t: number) => void;
};

export function PlaybackBar({ playing, progress, speed, onToggle, onReplay, onSpeed, onScrub }: Props) {
  const percent = Math.round(progress * 100);
  return (
    <div className={styles.bar}>
      <button type="button" className={styles.play} onClick={onToggle} aria-label={playing ? "Pause animation" : "Play animation"}>
        {playing ? "❚❚" : "▶"}
      </button>
      <button type="button" className={styles.replay} onClick={onReplay}>
        Replay
      </button>
      <input
        className={styles.scrubber}
        type="range"
        aria-label="Animation progress"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        onChange={(event) => onScrub(Number(event.target.value))}
      />
      <span className={styles.percent}>{percent}%</span>
      <div className={styles.speeds} role="group" aria-label="Playback speed">
        {SPEEDS.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={option === speed}
            className={option === speed ? styles.selected : undefined}
            onClick={() => onSpeed(option)}
          >
            {option}×
          </button>
        ))}
      </div>
    </div>
  );
}
