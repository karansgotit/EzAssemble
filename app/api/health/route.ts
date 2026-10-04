import { getVertexClient, VertexConfigError } from "@/pipeline/vertex";

export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // read the environment on every request, never at build time

// Deploy check (SMI-10): are the Google Cloud settings present and well-formed on this server?
// It makes no AI call and returns no values, only whether each setting is usable.
export function GET(): Response {
  const settings = {
    project: Boolean(process.env.GOOGLE_CLOUD_PROJECT),
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
    credentials: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON),
  };
  try {
    getVertexClient();
    return Response.json({ ok: true, ...settings, mockAi: process.env.NEXT_PUBLIC_MOCK_AI === "1" });
  } catch (error) {
    const problem = error instanceof VertexConfigError ? error.message : "The AI client could not be created.";
    return Response.json({ ok: false, ...settings, problem }, { status: 503 });
  }
}
