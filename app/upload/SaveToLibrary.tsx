"use client";

import Link from "next/link";
import { useState } from "react";
import { getApi } from "@/client/api";
import type { Crop } from "@/client/processManual";
import type { SavedManual } from "@/schema";
import styles from "./upload.module.css";

type State = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "failed"; error: string };

/** Dev-only button (FR-19): writes the processed manual into public/manuals/ so it opens from the library with no AI calls. */
export function SaveToLibrary({ manual, crops }: { manual: SavedManual; crops: Crop[] }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  if (process.env.NODE_ENV !== "development") return null;

  async function save() {
    setState({ kind: "saving" });
    const result = await getApi().saveManual({ manual, crops });
    setState(result.ok ? { kind: "saved" } : { kind: "failed", error: result.error ?? "The manual couldn't be saved." });
  }

  return (
    <span className={styles.save}>
      <button type="button" onClick={save} disabled={state.kind === "saving"}>
        {state.kind === "saving" ? "Saving…" : state.kind === "saved" ? "Save again" : "Save to library"}
      </button>
      {state.kind === "saved" && (
        <span role="status">
          Saved. <Link href={`/m/${manual.id}`}>Open it from the library</Link>
        </span>
      )}
      {state.kind === "failed" && (
        <span role="alert" className={styles.saveError}>
          {state.error}
        </span>
      )}
    </span>
  );
}
