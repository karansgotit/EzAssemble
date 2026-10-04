"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { type Loaded, loadLibrary, manualBaseUrl } from "@/client/loadManual";
import type { LibraryIndex } from "@/schema";
import { ErrorScreen } from "./components/ErrorScreen";
import styles from "./library.module.css";

/** The library: every saved manual, plus a card that leads to the upload page (FR-01, FR-03). */
export default function LibraryPage() {
  const [library, setLibrary] = useState<Loaded<LibraryIndex> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadLibrary().then((result) => {
      if (!cancelled) setLibrary(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (library && !library.ok) return <ErrorScreen title="The manual library couldn't be loaded" errors={library.errors} />;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>EzAssemble</h1>
        <p>Turn a confusing IKEA assembly manual into clear, animated 3D steps.</p>
      </header>

      <ul className={styles.grid} aria-busy={library === null}>
        {library === null && <li className={`${styles.card} ${styles.loading}`}>Loading manuals…</li>}
        {library?.data.map((manual) => (
          <li key={manual.id}>
            <Link className={styles.card} href={`/m/${manual.id}`}>
              <img src={manualBaseUrl(manual.id) + manual.thumbnail} alt="" />
              <strong>{manual.title}</strong>
              <span>
                {manual.stepCount} {manual.stepCount === 1 ? "step" : "steps"}
              </span>
            </Link>
          </li>
        ))}
        <li>
          <Link className={`${styles.card} ${styles.upload}`} href="/upload">
            <span className={styles.plus} aria-hidden="true">
              +
            </span>
            <strong>Upload a manual</strong>
            <span>Add your own IKEA manual as a PDF</span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
