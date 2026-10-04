import "server-only";
import { ApiError } from "@google/genai";
import type { z } from "zod";
import { VertexConfigError } from "./vertex";

// The shared shape of every AI route (CONTRACTS §5): 400 for a bad body, 200 with the ApiResult (including
// ok: false when the AI kept failing), 503 when Vertex AI is unreachable or not configured, 500 otherwise.
export async function handleAiRoute<Req, Res>(request: Request, schema: z.ZodType<Req>,
  run: (body: Req, signal: AbortSignal) => Promise<Res>): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: "The request body is not JSON." }, { status: 400 });
  }
  const body = schema.safeParse(json);
  if (!body.success) {
    const problems = body.error.issues.map(issue => `${issue.path.join(".") || "body"}: ${issue.message}`);
    return Response.json({ ok: false, error: problems.join("; ") }, { status: 400 });
  }

  try {
    return Response.json(await run(body.data, request.signal));
  } catch (error) {
    // Never echo raw SDK errors: they can contain request data or credentials.
    if (isUnavailable(error)) {
      console.error(`[route] ${new URL(request.url).pathname}: AI service unavailable (${describe(error)})`);
      return Response.json({ ok: false, error: "The AI service is unavailable right now." }, { status: 503 });
    }
    console.error(`[route] ${new URL(request.url).pathname}: unexpected ${describe(error)}`);
    return Response.json({ ok: false, error: "Something went wrong on the server." }, { status: 500 });
  }
}

function isUnavailable(error: unknown): boolean {
  if (error instanceof VertexConfigError) return true;
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500 || error.status === 401 || error.status === 403;
  return error instanceof TypeError && /fetch/i.test(error.message); // network down
}

function describe(error: unknown): string {
  if (error instanceof ApiError) return `HTTP ${error.status}`;
  return error instanceof Error ? error.name : "unknown error";
}
