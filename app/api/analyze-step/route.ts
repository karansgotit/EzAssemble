import { AnalyzeStepRequest } from "@/schema";
import { analyzeStep } from "@/pipeline/analyzeStep";
import { handleAiRoute } from "@/pipeline/route";

export const runtime = "nodejs";
export const maxDuration = 60;

// Call 3: one step's actions, checked with checkStep against the parts and what is already placed. CONTRACTS §5.
export function POST(request: Request): Promise<Response> {
  return handleAiRoute(request, AnalyzeStepRequest, (body, signal) => analyzeStep(body, { signal }));
}
