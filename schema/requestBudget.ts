import { z } from "zod";

// JSON UTF-8 bytes, including base64 and metadata; leave headroom below Vercel's 4.5 MB limit.
export const MAX_REQUEST_BYTES = 4_000_000;
export const MAX_IMAGE_BASE64_CHARS = 1_500_000;

export function requestBytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

export function checkRequestBudget(value: unknown, ctx: z.RefinementCtx): void {
  if (requestBytes(value) > MAX_REQUEST_BYTES) {
    ctx.addIssue({ code: "custom", message: "The complete request exceeds 4,000,000 bytes. Reduce the image sizes before sending it." });
  }
}
