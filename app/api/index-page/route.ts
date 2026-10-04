import { IndexPageRequest } from "@/schema";
import { indexPage } from "@/pipeline/indexPage";
import { handleAiRoute } from "@/pipeline/route";

export const runtime = "nodejs";
export const maxDuration = 60;

// Call 1 (fast model): page type + one box per numbered step. CONTRACTS §5.
export function POST(request: Request): Promise<Response> {
  return handleAiRoute(request, IndexPageRequest, (body, signal) => indexPage(body, { signal }));
}
