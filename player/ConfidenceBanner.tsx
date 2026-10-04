import type { Confidence } from "./tempContracts";
import styles from "./StepPlayer.module.css";

/** Shown when the AI was unsure about a step (FR-37). */
export function ConfidenceBanner({ confidence }: { confidence: Confidence }) {
  if (confidence !== "low") return null;
  return (
    <p className={styles.banner} role="status">
      <strong>Double-check this step.</strong> The AI wasn&apos;t sure about it, so compare with the original diagram.
    </p>
  );
}
