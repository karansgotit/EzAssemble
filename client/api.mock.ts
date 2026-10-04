// The same Api as client/api.ts, answered from a saved manual instead of Gemini. No AI calls, no cost.
import type { ApiResult, SavedManual, Usage } from "@/schema";
import type { Api, SaveResult } from "./api";

export type MockOptions = {
  failStep?: number; // this step number answers ok: false (?mockFail=7), to exercise the fallbacks
  delay?: () => Promise<void>; // tests pass a no-op
  saveManual?: Api["saveManual"]; // saving costs nothing, so mock mode can still use the real route
};

const MOCK_USAGE: Usage[] = [{ model: "mock", inputTokens: 0, outputTokens: 0, ms: 0 }];

function randomDelay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 1200));
}

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data, attempts: 1, usage: MOCK_USAGE };
}

function fail<T>(message: string, attempts = 1): ApiResult<T> {
  return { ok: false, errors: [message], attempts, usage: MOCK_USAGE };
}

export function createMockApi(source: SavedManual, options: MockOptions = {}): Api {
  const delay = options.delay ?? randomDelay;
  return {
    async indexPage(req) {
      await delay();
      const page = source.pages[req.pageNumber - 1];
      return page ? ok(page) : fail(`Mock: the saved manual has no page ${req.pageNumber}.`);
    },

    async parts() {
      await delay();
      return ok(source.layout);
    },

    async analyzeStep(req) {
      await delay();
      if (req.stepNumber === options.failStep) return fail(`Mock: step ${req.stepNumber} was told to fail (mockFail).`, 3);
      const saved = source.steps.find((s) => s.status === "ok" && s.step.stepNumber === req.stepNumber);
      return saved?.status === "ok" ? ok(saved.step) : fail(`Mock: the saved manual has no analysed step ${req.stepNumber}.`, 3);
    },

    async saveManual(req): Promise<SaveResult> {
      return options.saveManual ? options.saveManual(req) : { ok: false, error: "Mock: saving is not connected." };
    },
  };
}
