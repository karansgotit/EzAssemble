"use client";

import { jpegDataUrl } from "@/client/canvas";
import { formatUsd } from "@/client/uploadForm";
import type { SavedManual, SavedStep } from "@/schema";
import styles from "./upload.module.css";

export type PageThumb = { pageNumber: number; jpegBase64: string; width: number; height: number };

type Props = {
  title: string;
  status: string; // the stage line, e.g. "Analysing step 7 of 19"
  fraction: number; // 0..1 across the whole run, for the loading bar
  notice: string | null; // skipped pages or missing steps
  running: boolean;
  longWait: boolean; // the parts stage: one long call with nothing to count
  manual: SavedManual | null; // grows by one step at a time
  totalSteps: number | null;
  pages: PageThumb[]; // every page of the PDF
  pagesRead: number; // how many have been looked at so far
  onCancel: () => void;
  onOpenPlayer: () => void;
  onStartOver: () => void;
};

function describe(step: SavedStep): { number: number; text: string; tone: "ok" | "unsure" | "unread" | "note" } {
  if (step.status === "ok") return { number: step.step.stepNumber, text: step.step.instruction, tone: step.step.confidence === "low" ? "unsure" : "ok" };
  if (step.status === "failed") return { number: step.stepNumber, text: "Couldn't be read. You'll see the original drawing for this step.", tone: "unread" };
  return { number: step.stepNumber, text: step.message, tone: "note" };
}

/** The waiting screen: the manual's own pages being worked through, and its steps arriving as sentences (FR-17, FR-20). */
export function ProgressView(props: Props) {
  const { title, status, fraction, notice, running, longWait, manual, totalSteps, pages, pagesRead, onCancel, onOpenPlayer, onStartOver } = props;
  const steps = manual?.steps ?? [];
  const waiting = Math.max((totalSteps ?? 0) - steps.length, 0);
  const percent = Math.round(fraction * 100);

  return (
    <section className={styles.progress}>
      <header className={styles.head}>
        <h1>{title}</h1>
        {running ? (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <div className={styles.actions}>
            {steps.length > 0 && (
              <button type="button" className="btn btn-primary" onClick={onOpenPlayer}>
                Open the {steps.length} {steps.length === 1 ? "step" : "steps"}
              </button>
            )}
            <button type="button" className="btn" onClick={onStartOver}>
              Upload another manual
            </button>
          </div>
        )}
      </header>

      <div className={styles.bar} role="progressbar" aria-label="Reading the manual" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} data-running={running}>
        <div style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.status} role="status" data-testid="status">
        <span>{status}</span>
        <span className={styles.meta}>
          {running && `${percent}%`}
          {process.env.NODE_ENV === "development" && ` · ${formatUsd(manual?.usage?.estUsd)}`}
        </span>
      </p>
      {running && longWait && <p className={styles.hint}>This is the longest single stretch: usually 20 to 50 seconds.</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.columns}>
        {pages.length > 0 && (
          <section aria-label="The manual's pages">
            <h2 className="eyebrow">The manual · {pages.length} pages</h2>
            <ol className={styles.pages}>
              {pages.map((page, i) => (
                <li key={page.pageNumber} data-state={!running || i < pagesRead ? "read" : i < pagesRead + 4 ? "reading" : "waiting"}>
                  <img src={jpegDataUrl(page.jpegBase64)} alt={`Page ${page.pageNumber}`} width={page.width} height={page.height} />
                </li>
              ))}
            </ol>
          </section>
        )}

        <section aria-label="Steps read so far">
          <h2 className="eyebrow">Read so far</h2>
          <ol className={styles.steps}>
            {steps.map((step) => {
              const { number, text, tone } = describe(step);
              return (
                <li key={number} data-tone={tone}>
                  <span className={styles.stepNumber}>{number}</span>
                  <span>{text}</span>
                </li>
              );
            })}
            {running && (
              <li data-tone="pending">
                <span className={styles.stepNumber}>…</span>
                <span>{steps.length === 0 ? "The first step appears here as soon as it is read." : `${waiting} more ${waiting === 1 ? "step" : "steps"} to go`}</span>
              </li>
            )}
          </ol>
        </section>
      </div>
    </section>
  );
}
