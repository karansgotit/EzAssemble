import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/route";

afterEach(() => vi.unstubAllEnvs());

describe("GET /api/health", () => {
  it("answers 503 and names the missing setting, without leaking values", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", "");
    const response = GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, project: false, location: "global", credentials: false, problem: "GOOGLE_CLOUD_PROJECT is not set." });
  });

  it("reports a key that is not valid JSON", async () => {
    vi.stubEnv("GOOGLE_CLOUD_PROJECT", "demo-project");
    vi.stubEnv("GOOGLE_SERVICE_ACCOUNT_JSON", "{broken");
    const body = await GET().json();
    expect(body).toMatchObject({ ok: false, project: true, credentials: true, problem: "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON." });
    expect(JSON.stringify(body)).not.toContain("demo-project");
  });
});
