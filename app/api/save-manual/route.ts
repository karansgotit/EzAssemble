import path from "node:path";
import { SaveManualRequest } from "@/schema";
import { saveToLibrary } from "./saveToLibrary";

export const runtime = "nodejs";
export const maxDuration = 60;

// Dev only (D-11, FR-19): writes into this checkout's public/manuals/, to be reviewed and committed by hand.
// A deployed site has no writable disk and must never accept this, so everywhere else it answers 404.
export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ ok: false, error: "The request body is not JSON." }, { status: 400 });
  }
  const body = SaveManualRequest.safeParse(json);
  if (!body.success) {
    const problems = body.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    return Response.json({ ok: false, error: problems.join("; ") }, { status: 400 });
  }

  try {
    const outcome = await saveToLibrary(body.data, path.join(process.cwd(), "public", "manuals"));
    return Response.json(outcome, { status: outcome.ok ? 200 : 400 });
  } catch (error) {
    return Response.json({ ok: false, error: `Couldn't write the files: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
  }
}
