const seen = new Set<string>();

// Bad data is reported once, not on every step change or replay.
export function warnOnce(message: string): void {
  if (seen.has(message)) return;
  seen.add(message);
  console.warn(`[scene] ${message}`);
}

export function forgetWarnings(): void {
  seen.clear();
}
