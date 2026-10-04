"use client";

import { useState } from "react";
import styles from "./StepPlayer.module.css";

type Props = {
  src?: string; // URL of the step's crop from the manual
  stepNumber: number;
  large?: boolean; // info and failed steps: the drawing is the main content
};

/** The original drawing from the manual, on its own sheet. A missing or broken image shows a message, never a blank box. */
export function DiagramPanel({ src, stepNumber, large = false }: Props) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const available = src !== undefined && src !== failedSrc;

  return (
    <figure className={large ? `${styles.sheet} ${styles.sheetLarge}` : styles.sheet}>
      <figcaption className="eyebrow">From the manual</figcaption>
      {available ? (
        <img src={src} alt={`Original manual drawing for step ${stepNumber}`} onError={() => setFailedSrc(src)} />
      ) : (
        <p className={styles.sheetMissing}>The drawing for this step isn&apos;t available.</p>
      )}
    </figure>
  );
}
