// Loads the saved library: static JSON under public/manuals/. No AI calls.
// Everything is validated with Zod before the app uses it; failures come back as readable messages.
import type { z } from "zod";
import { LibraryIndex, SavedManual } from "@/schema";

export type Loaded<T> = { ok: true; data: T } | { ok: false; errors: string[] };

type Fetcher = (url: string) => Promise<Response>;

const MANUAL_ID = /^[a-z0-9-]{1,40}$/;
const browserFetch: Fetcher = (url) => fetch(url);

/** Folder a manual's files are served from, e.g. "/manuals/kallax/". Crop paths are relative to it. */
export function manualBaseUrl(id: string): string {
  return `/manuals/${id}/`;
}

async function loadJson<T>(url: string, schema: z.ZodType<T>, what: string, fetcher: Fetcher): Promise<Loaded<T>> {
  let response: Response;
  try {
    response = await fetcher(url);
  } catch {
    return { ok: false, errors: [`Couldn't load ${what}. Check your connection and try again.`] };
  }
  if (response.status === 404) return { ok: false, errors: [`${what} was not found (${url}).`] };
  if (!response.ok) return { ok: false, errors: [`Couldn't load ${what} (the server answered ${response.status}).`] };

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, errors: [`${what} is not valid JSON (${url}).`] };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message));
    return { ok: false, errors: [`${what} has ${problems.length} problem${problems.length === 1 ? "" : "s"} (${url}):`, ...problems] };
  }
  return { ok: true, data: parsed.data };
}

/** The list of saved manuals shown on the home page. */
export function loadLibrary(fetcher: Fetcher = browserFetch): Promise<Loaded<LibraryIndex>> {
  return loadJson("/manuals/index.json", LibraryIndex, "The manual library", fetcher);
}

/** One saved manual: the raw AI output, exactly as stored. */
export async function loadManual(id: string, fetcher: Fetcher = browserFetch): Promise<Loaded<SavedManual>> {
  if (!MANUAL_ID.test(id)) return { ok: false, errors: [`"${id}" is not a valid manual id.`] };
  const loaded = await loadJson(`${manualBaseUrl(id)}manual.json`, SavedManual, `The manual "${id}"`, fetcher);
  if (loaded.ok && loaded.data.id !== id) {
    return { ok: false, errors: [`The file for "${id}" says it is the manual "${loaded.data.id}".`] };
  }
  return loaded;
}
