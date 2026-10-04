"use client";

import { useEffect, useRef } from "react";

export type PlayerKeyHandlers = {
  onPrev: () => void;
  onNext: () => void;
  onToggle?: () => void; // omit on steps with no animation
  onReplay?: () => void;
};

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.closest("input, select, textarea") !== null);
}

/** Keyboard shortcuts for the player: ← → change step, Space plays/pauses, R replays. */
export function usePlayerKeys(handlers: PlayerKeyHandlers): void {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Leave browser shortcuts (Cmd+R, Alt+←) and typing alone.
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      const { onPrev, onNext, onToggle, onReplay } = latest.current;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onNext();
      } else if (event.code === "Space" && onToggle) {
        // A focused button already reacts to Space; don't act twice.
        if (event.target instanceof HTMLElement && event.target.closest("button, a")) return;
        event.preventDefault();
        onToggle();
      } else if (event.key.toLowerCase() === "r" && onReplay) {
        onReplay();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
