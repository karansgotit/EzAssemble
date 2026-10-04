import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../", import.meta.url));

// Run the actual CLI entry point with a fake SDK method, never real credentials or a network call.
function runSmoke(mode: "valid" | "invalid" | "throws") {
  return spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "-e", `
    globalThis.fetch = async () => { throw new Error("Network is forbidden in this test"); };
    process.env.GOOGLE_CLOUD_PROJECT = "offline-test";
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      type: "service_account", project_id: "offline-test", client_email: "test@example.com",
      private_key: "-----BEGIN PRIVATE KEY-----fake"
    });
    const { getVertexClient } = require("./pipeline/vertex.ts");
    getVertexClient().models.generateContent = async () => {
      if (${JSON.stringify(mode)} === "throws") throw new Error("simulated outage");
      return {
        text: ${JSON.stringify(mode)} === "invalid" ? "invalid JSON" : JSON.stringify({
          stepNumber: 3, numberBox: [10, 10, 20, 20], summary: "Insert the dowels."
        }),
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 }
      };
    };
    require("./pipeline/scripts/smoke.ts");
  `], { cwd: root, env: { PATH: process.env.PATH, NODE_ENV: "test" }, encoding: "utf8", timeout: 10000 });
}

describe("pipeline smoke script exit status", () => {
  it.each([
    ["valid", 0, '"ok": true'],
    ["invalid", 1, '"ok": false'],
    ["throws", 1, "Smoke test failed"],
  ] as const)("handles %s model responses", (mode, status, output) => {
    const result = runSmoke(mode);
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(status);
    expect(result.stdout + result.stderr).toContain(output);
    if (mode === "invalid") expect(result.stdout).toContain('"attempts": 3');
  }, 15000);
});
