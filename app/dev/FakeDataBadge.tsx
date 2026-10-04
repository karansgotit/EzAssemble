"use client";

// Development-only switch for fake data (see fake-data/README.md). Rendered by app/layout.tsx.
import { useSyncExternalStore } from "react";
import { fakeDataDefault, isFakeDataOn, setFakeDataOverride } from "@/fake-data/toggle";
import styles from "./FakeDataBadge.module.css";

function subscribe() {
  return () => {}; // the page reloads after every change, so there is nothing to listen for
}

export function FakeDataBadge() {
  const on = useSyncExternalStore(subscribe, isFakeDataOn, fakeDataDefault);
  const overridden = on !== fakeDataDefault();

  function change(value: boolean | null) {
    setFakeDataOverride(value);
    window.location.reload();
  }

  return (
    <div className={styles.badge} data-on={on}>
      <button type="button" aria-pressed={on} onClick={() => change(!on)} title="Switch between fake data and the real API">
        Fake data: {on ? "ON" : "OFF"}
      </button>
      {overridden && (
        <button type="button" onClick={() => change(null)} title="Go back to NEXT_PUBLIC_MOCK_AI from .env.local">
          reset
        </button>
      )}
    </div>
  );
}
