"use client";

import { type DragEvent, useState } from "react";
import { fileProblem } from "@/client/uploadForm";
import styles from "./DropZone.module.css";

type Props = { onFile: (file: File) => void; problem?: string | null };

/** The one way a manual gets in: drop a PDF, or click to choose one. Choosing starts the upload (FR-10). */
export function DropZone({ onFile, problem = null }: Props) {
  const [found, setFound] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const message = found ?? problem;

  function choose(file: File | undefined) {
    if (!file) return;
    const wrong = fileProblem(file);
    setFound(wrong);
    if (!wrong) onFile(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  return (
    <div className={styles.wrap}>
      <label
        className={styles.zone}
        data-dragging={dragging}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          aria-label="Assembly manual PDF"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = ""; // so choosing the same file again starts a new upload
          }}
        />
        <svg className={styles.sheetIcon} viewBox="0 0 48 60" aria-hidden="true">
          <path d="M3 3h28l14 14v40H3z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
          <path d="M31 3v14h14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
        </svg>
        <strong>{dragging ? "Drop it to start" : "Drop your assembly manual here"}</strong>
        <span>PDF of an IKEA assembly manual · or choose a file</span>
      </label>
      {message && (
        <p className={styles.problem} role="alert">
          <span aria-hidden="true">✗</span> {message}
        </p>
      )}
    </div>
  );
}
