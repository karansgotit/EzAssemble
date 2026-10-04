import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/analyze-step/route";
import { layout } from "./helpers/schemaFixtures";

const post = (body: unknown) => new Request("http://localhost/api/analyze-step", { method: "POST", body: JSON.stringify(body) });
const request = { image: "/9j/", stepNumber: 2, parts: layout.parts, placedPartIds: ["E1", "L1"], previousInstructions: ["Step 1."] };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("POST /api/analyze-step", () => {
  it("answers 400 for a fractional step number or a placed id that isn't a part id", async () => {
    expect((await POST(post({ ...request, stepNumber: 2.5 }))).status).toBe(400);
    expect((await POST(post({ ...request, placedPartIds: ["not an id!"] }))).status).toBe(400);
  });

  it("answers 503 without Google Cloud settings, and never reaches the network", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    vi.stubGlobal("fetch", async () => { throw new Error("network is forbidden in tests"); });
    expect((await POST(post(request))).status).toBe(503);
  });
});
