import "server-only";
import { IndexPageRequest, PageIndex } from "@/schema";
import { callStructured, type StructuredOptions } from "./gemini";
import { loadPrompt } from "./prompts";

// Call 1: what kind of page is this, and where is each numbered step on it? Shared by the route and scripts.
export function indexPage(request: IndexPageRequest, options: Partial<Pick<StructuredOptions<PageIndex>,
  "generate" | "signal" | "timeoutMs" | "onRejected">> = {}) {
  const input = IndexPageRequest.parse(request);
  return callStructured({
    ...options,
    model: "fast",
    prompt: loadPrompt("index-page", { pageNumber: input.pageNumber }),
    images: [input.image],
    schema: PageIndex,
    semanticCheck: page => checkPage(page),
  });
}

// The same step number twice on one page (outside alternative builds) means a box was split or invented.
function checkPage(page: PageIndex): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  if (page.pageType === "steps" && page.steps.length === 0) {
    errors.push('A steps page must contain at least one numbered step box. Include the visible steps, or correct the page type if there are none.');
  }
  for (const step of page.steps) {
    const key = `${step.stepNumber}/${step.variant ?? ""}`;
    if (seen.has(key)) errors.push(`step ${step.stepNumber} appears twice on this page; give each step one box.`);
    seen.add(key);
  }
  return errors;
}
