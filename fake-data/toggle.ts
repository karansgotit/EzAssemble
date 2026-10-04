// One switch for "use fake data instead of calling the real API".
// Default: NEXT_PUBLIC_MOCK_AI in .env.local. In development, the "Fake data" badge in the corner of
// every page overrides it for this browser, with no restart. Production builds only read the env var.

const STORAGE_KEY = "ezassemble.fakeData";

/** Pure: the override wins when it is allowed and set; otherwise the env default applies. */
export function resolveFakeData(envDefault: boolean, override: string | null, allowOverride: boolean): boolean {
  if (allowOverride && (override === "1" || override === "0")) return override === "1";
  return envDefault;
}

export function fakeDataDefault(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_AI === "1";
}

function readOverride(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked: fall back to the env default
  }
}

/** Ask this before any call that would reach the real API. */
export function isFakeDataOn(): boolean {
  return resolveFakeData(fakeDataDefault(), readOverride(), process.env.NODE_ENV === "development");
}

/** Development only. `null` removes the override, going back to the .env.local default. */
export function setFakeDataOverride(value: boolean | null): void {
  try {
    if (value === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // storage blocked: nothing to remember
  }
}
