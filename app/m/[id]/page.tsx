"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { loadManual } from "@/client/loadManual";
import { type SceneResult, sceneManualFor } from "@/client/sceneManualFor";
import { StepPlayer } from "@/player/StepPlayer";
import { ErrorScreen } from "../../components/ErrorScreen";
import styles from "../../library.module.css";

/** "/m/kallax": loads a saved manual, validates it, and plays it. Invalid data shows the red error screen (FR-02). */
export default function ManualPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<SceneResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    loadManual(id).then((loaded) => {
      if (!cancelled) setResult(loaded.ok ? sceneManualFor(loaded.data) : loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (result === null) return <p className={styles.status}>Opening the manual…</p>;
  if (!result.ok) return <ErrorScreen title="This manual couldn't be opened" errors={result.errors} />;

  return (
    <>
      <Link className={styles.back} href="/">
        ← Library
      </Link>
      <StepPlayer manual={result.manual} mode="library" />
    </>
  );
}
