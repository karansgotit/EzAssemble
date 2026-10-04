import { PartsRequest } from "@/schema";
import { partsLayout } from "@/pipeline/partsLayout";
import { handleAiRoute } from "@/pipeline/route";

export const runtime = "nodejs";
export const maxDuration = 60;

// Call 2: parts list + rough layout, checked with checkPartsLayout. CONTRACTS §5.
export function POST(request: Request): Promise<Response> {
  return handleAiRoute(request, PartsRequest, (body, signal) => partsLayout(body, { signal }));
}
