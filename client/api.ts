import type { z } from "zod";
import {
  AnalyzeStepRequest,
  type ApiResult,
  IndexPageRequest,
  PageIndex,
  PartsLayout,
  type PartsRequest,
  SavedManual,
  SaveManualRequest,
  Step,
} from "@/schema";
import goldKallax from "@/fixtures/kallax.gold.json";
import { createMockApi } from "./api.mock";
import { isMockAiOn } from "./mockMode";
import { preparePartsRequest } from "./partsRequest";

/** `timeoutMs` defaults to 60 s; re-analyze passes 20 s. `signal` cancels (the upload page's Cancel button). */
export type CallOptions = { timeoutMs?: number; signal?: AbortSignal };

export type SaveResult = { ok: boolean; path?: string; error?: string };

export interface Api {
  indexPage(req: IndexPageRequest, opts?: CallOptions): Promise<ApiResult<PageIndex>>;
  parts(req: PartsRequest, opts?: CallOptions): Promise<ApiResult<PartsLayout>>;
  analyzeStep(req: AnalyzeStepRequest, opts?: CallOptions): Promise<ApiResult<Step>>;
  saveManual(req: SaveManualRequest): Promise<SaveResult>;
}

/** What the client needs from the outside world; tests replace both. */
export type ApiDeps = { fetch: typeof fetch; sleep: (ms: number) => Promise<void> };

const DEFAULT_TIMEOUT_MS = 60_000;
const RETRY_DELAY_MS = 2_000;

const browserDeps: ApiDeps = {
  fetch: (input, init) => fetch(input, init),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

function failure<T>(...errors: string[]): ApiResult<T> {
  return { ok: false, errors, attempts: 0, usage: [] };
}

function issues(error: z.ZodError): string[] {
  return error.issues.map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message));
}

type Sent = { kind: "response"; response: Response } | { kind: "failed"; message: string; retry: boolean };

async function send(path: string, body: unknown, opts: CallOptions, deps: ApiDeps): Promise<Sent> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const cancel = () => controller.abort();
  opts.signal?.addEventListener("abort", cancel);
  try {
    if (opts.signal?.aborted) return { kind: "failed", message: "Cancelled.", retry: false };
    const response = await deps.fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status >= 500) {
      const message = response.status === 503 ? "The AI service is unavailable right now." : `The server failed (${response.status}).`;
      return { kind: "failed", message, retry: true };
    }
    return { kind: "response", response };
  } catch {
    if (timedOut) return { kind: "failed", message: `The request timed out after ${Math.round(timeoutMs / 1000)} s.`, retry: false };
    if (opts.signal?.aborted) return { kind: "failed", message: "Cancelled.", retry: false };
    return { kind: "failed", message: "Couldn't reach the server. Check your connection.", retry: true };
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", cancel);
  }
}

/** POSTs JSON. Retries once, after 2 s, on a network error or a 5xx; never on anything else (CONTRACTS §5). */
async function sendWithRetry(path: string, body: unknown, opts: CallOptions, deps: ApiDeps): Promise<Sent> {
  const first = await send(path, body, opts, deps);
  if (first.kind === "response" || !first.retry) return first;
  await deps.sleep(RETRY_DELAY_MS);
  return send(path, body, opts, deps);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** One AI route call. Never throws: every problem comes back as `ok: false` with readable errors. */
async function callAi<T>(
  path: string,
  body: unknown,
  data: z.ZodType<T>,
  opts: CallOptions,
  deps: ApiDeps,
): Promise<ApiResult<T>> {
  const sent = await sendWithRetry(path, body, opts, deps);
  if (sent.kind === "failed") return failure(sent.message);

  const json = await readJson(sent.response);
  if (!sent.response.ok) {
    const detail = isRecord(json) && typeof json.error === "string" ? `: ${json.error}` : "";
    return failure(`The server rejected the request (${sent.response.status})${detail}`);
  }
  if (!isRecord(json) || typeof json.ok !== "boolean") return failure("The server sent an unexpected response.");

  const attempts = typeof json.attempts === "number" ? json.attempts : 0;
  const usage = Array.isArray(json.usage) ? (json.usage as ApiResult<T>["usage"]) : [];
  if (!json.ok) {
    const errors = Array.isArray(json.errors) ? json.errors.filter((e): e is string => typeof e === "string") : [];
    return { ok: false, errors: errors.length ? errors : ["The AI couldn't produce a valid answer."], attempts, usage };
  }
  const parsed = data.safeParse(json.data);
  if (!parsed.success) return { ok: false, errors: ["The server sent data in an unexpected shape.", ...issues(parsed.error)], attempts, usage };
  return { ok: true, data: parsed.data, attempts, usage };
}

export function createApi(deps: ApiDeps = browserDeps): Api {
  return {
    async indexPage(req, opts = {}) {
      const body = IndexPageRequest.safeParse(req);
      if (!body.success) return failure(...issues(body.error));
      return callAi("/api/index-page", body.data, PageIndex, opts, deps);
    },

    async parts(req, opts = {}) {
      let body;
      try {
        body = await preparePartsRequest(req); // shrinks images to fit the byte budget; throws if it can't
      } catch (error) {
        return failure(error instanceof Error ? error.message : "The parts request is invalid.");
      }
      return callAi("/api/parts", body, PartsLayout, opts, deps);
    },

    async analyzeStep(req, opts = {}) {
      const body = AnalyzeStepRequest.safeParse(req);
      if (!body.success) return failure(...issues(body.error));
      return callAi("/api/analyze-step", body.data, Step, opts, deps);
    },

    async saveManual(req) {
      const body = SaveManualRequest.safeParse(req);
      if (!body.success) return { ok: false, error: issues(body.error).join("; ") };
      const sent = await send("/api/save-manual", body.data, {}, deps);
      if (sent.kind === "failed") return { ok: false, error: sent.message };
      const json = await readJson(sent.response);
      if (sent.response.status === 404) return { ok: false, error: "Saving to the library only works when running locally (npm run dev)." };
      if (!isRecord(json) || typeof json.ok !== "boolean") return { ok: false, error: "The server sent an unexpected response." };
      return {
        ok: json.ok,
        ...(typeof json.path === "string" && { path: json.path }),
        ...(typeof json.error === "string" && { error: json.error }),
      };
    },
  };
}

/** The API the app should use: the mock (saved KALLAX answers) in mock mode, otherwise the real routes. */
export function getApi(): Api {
  const real = createApi();
  if (!isMockAiOn()) return real;
  const failStep = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("mockFail");
  return createMockApi(SavedManual.parse(goldKallax), { failStep: failStep ? Number(failStep) : undefined, saveManual: real.saveManual });
}
