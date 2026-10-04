"use client";

import { formatUsd } from "@/client/uploadForm";
import type { SavedManual, SavedStep } from "@/schema";
import styles from "./upload.module.css";

type Props = {
  title: string;
  status: string; // the stage line, e.g. "Analysing step 7 of 19"
  fraction: number; // 0..1 across the whole run, for the loading bar
  notice: string | null; // skipped pages or missing steps
  running: boolean;
  manual: SavedManual | null; // grows by one step at a time
  totalSteps: number | null;
  onCancel: () => void;
  onOpenPlayer: () => void;
  onStartOver: () => void;
};

function describe(step: SavedStep): { number: number; text: string; tone: "ok" | "warn" | "muted" } {
  if (step.status === "ok") return { number: step.step.stepNumber, text: step.step.instruction, tone: step.step.confidence === "low" ? "warn" : "ok" };
  if (step.status === "failed") return { number: step.stepNumber, text: "Couldn't be read. The player will show the original diagram.", tone: "warn" };
  return { number: step.stepNumber, text: step.message, tone: "muted" };
}

/** The waiting screen: a loading bar, what is happening now, and the steps as they are read (FR-17, FR-20). */
export function ProgressView({ title, status, fraction, notice, running, manual, totalSteps, onCancel, onOpenPlayer, onStartOver }: Props) {
  const steps = manual?.steps ?? [];
  const waiting = Math.max((totalSteps ?? 0) - steps.length, 0);
  const percent = Math.round(fraction * 100);

  return (
    <section className={styles.progress}>
      <h2>{title}</h2>
      <div
        className={styles.bar}
        role="progressbar"
        aria-label="Processing the manual"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        data-running={running}
      >
        <div style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.status} role="status" data-testid="status">
        <span>{status}</span>
        <span className={styles.meta}>
          {running && `${percent}% · `}
          {formatUsd(manual?.usage?.estUsd)}
        </span>
      </p>
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.actions}>
        {running ? (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <>
            {steps.length > 0 && (
              <button type="button" className={styles.primary} onClick={onOpenPlayer}>
                Open the steps that were read
              </button>
            )}
            <button type="button" onClick={onStartOver}>
              Upload another manual
            </button>
          </>
        )}
      </div>

      <ol className={styles.steps} aria-label="Steps read so far">
        {steps.map((step) => {
          const { number, text, tone } = describe(step);
          return (
            <li key={number} data-tone={tone}>
              <span className={styles.stepNumber}>{number}</span>
              <span>{text}</span>
            </li>
          );
        })}
        {running && waiting > 0 && (
          <li data-tone="muted">
            <span className={styles.stepNumber}>…</span>
            <span>
              {waiting} more {waiting === 1 ? "step" : "steps"} to go
            </span>
          </li>
        )}
      </ol>
    </section>
  );
}
