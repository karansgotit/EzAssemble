"use client";

import { markerDescription, type StepMarker } from "./stepView";
import styles from "./StepNav.module.css";

type Props = {
  index: number; // 0-based
  markers: StepMarker[]; // one per step
  onChange: (index: number) => void;
  onFinish?: () => void; // pressing "next" on the last step
};

export function StepNav({ index, markers, onChange, onFinish }: Props) {
  const isLast = index >= markers.length - 1;
  return (
    <nav className={styles.nav} aria-label="Assembly steps">
      <button type="button" className={`btn btn-lg ${styles.prev}`} disabled={index <= 0} onClick={() => onChange(index - 1)}>
        <span aria-hidden="true">←</span> Previous
      </button>
      <ol className={styles.markers} data-many={markers.length > 24}>
        {markers.map((marker, i) => (
          <li key={i}>
            <button
              type="button"
              className={styles.marker}
              data-state={i === index ? "current" : i < index ? "done" : "todo"}
              data-kind={marker.kind}
              data-unsure={marker.unsure}
              aria-label={markerDescription(marker)}
              aria-current={i === index ? "step" : undefined}
              onClick={() => onChange(i)}
            >
              {marker.label}
              {marker.warning && <span className={styles.flag} aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ol>
      {isLast && onFinish ? (
        <button type="button" className={`btn btn-primary btn-lg ${styles.next}`} onClick={onFinish}>
          Finish <span aria-hidden="true">✓</span>
        </button>
      ) : (
        <button type="button" className={`btn btn-primary btn-lg ${styles.next}`} disabled={isLast} onClick={() => onChange(index + 1)}>
          Next step <span aria-hidden="true">→</span>
        </button>
      )}
    </nav>
  );
}
