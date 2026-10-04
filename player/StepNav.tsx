"use client";

import styles from "./StepNav.module.css";

type Props = {
  index: number; // 0-based
  labels: string[]; // one per step, shown on its dot, e.g. the manual's step number
  onChange: (index: number) => void;
};

export function StepNav({ index, labels, onChange }: Props) {
  const last = labels.length - 1;
  return (
    <nav className={styles.nav} aria-label="Assembly steps">
      <button type="button" className={styles.prev} disabled={index <= 0} onClick={() => onChange(index - 1)}>
        ← Previous
      </button>
      <ol className={styles.dots}>
        {labels.map((label, i) => (
          <li key={i}>
            <button
              type="button"
              className={i === index ? styles.current : i < index ? styles.visited : undefined}
              aria-label={`Go to step ${label}`}
              aria-current={i === index ? "step" : undefined}
              onClick={() => onChange(i)}
            >
              {label}
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className={styles.next} disabled={index >= last} onClick={() => onChange(index + 1)}>
        Next step →
      </button>
    </nav>
  );
}
