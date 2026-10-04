"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { type Loaded, loadManual, manualBaseUrl } from "@/client/loadManual";
import { StepPlayer } from "@/player/StepPlayer";
import { buildSceneManual } from "@/scene/buildSceneManual";
import type { SceneManual } from "@/schema";
import { ErrorScreen } from "../../components/ErrorScreen";
import styles from "../../home.module.css";

/** "/m/kallax": loads a saved manual, validates it, and plays it. Invalid data shows the red error screen (FR-02). */
export default function ManualPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<Loaded<SceneManual> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    loadManual(id).then((loaded) => {
      if (cancelled) return;
      if (!loaded.ok) return setResult(loaded);
      // Geometry is recomputed from the raw saved data every time a manual opens (D-09).
      const { manual, layoutErrors } = buildSceneManual(loaded.data, manualBaseUrl(id));
      if (layoutErrors.length) console.warn(`Layout problems in "${id}":`, layoutErrors);
      setResult({ ok: true, data: manual });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (result === null) return <p className={styles.status}>Opening the manual…</p>;
  if (!result.ok) return <ErrorScreen title="This manual couldn't be opened" errors={result.errors} />;

  return <StepPlayer manual={result.data} mode="library" back={<Link href="/">← All manuals</Link>} />;
}
