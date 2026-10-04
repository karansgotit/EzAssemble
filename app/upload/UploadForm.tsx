"use client";

import { type DragEvent, useState } from "react";
import { fileProblem } from "@/client/uploadForm";
import styles from "./upload.module.css";

type Props = { onStart: (file: File) => void; lastError: string | null };

/** The whole form is one drop zone: choosing a PDF starts the upload (FR-10). */
export function UploadForm({ onStart, lastError }: Props) {
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const message = problem ?? lastError;

  function choose(file: File | undefined) {
    if (!file) return;
    const found = fileProblem(file);
    setProblem(found);
    if (!found) onStart(file);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  }

  return (
    <div className={styles.form}>
      {message && (
        <p className={styles.alert} role="alert">
          {message}
        </p>
      )}
      <label
        className={dragging ? `${styles.drop} ${styles.dropActive}` : styles.drop}
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
          aria-label="Manual PDF"
          onChange={(event) => {
            choose(event.target.files?.[0]);
            event.target.value = ""; // so choosing the same file again starts a new upload
          }}
        />
        <strong>Drop your IKEA manual here, or click to choose it</strong>
        <span>PDF only. We&apos;ll turn it into step-by-step 3D instructions.</span>
      </label>
    </div>
  );
}
