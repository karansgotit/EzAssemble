"use client";

import { useSyncExternalStore } from "react";
import styles from "./ThemeToggle.module.css";
import { THEME_STORAGE_KEY as STORAGE_KEY } from "./themeBoot";

type Theme = "light" | "dark";
const EVENT = "ezassemble:theme";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

const currentTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** The light / dark switch, in the top right corner of every page. */
export function ThemeToggle() {
  const theme = useSyncExternalStore<Theme>(subscribe, currentTheme, () => "light");
  const next: Theme = theme === "dark" ? "light" : "dark";

  function change() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the choice lasts for this page only
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button type="button" className={styles.toggle} onClick={change} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
          </>
        ) : (
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
        )}
      </svg>
    </button>
  );
}
