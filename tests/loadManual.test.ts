import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadLibrary, loadManual, manualBaseUrl } from "@/client/loadManual";
import { sceneManualFor } from "@/client/sceneManualFor";

// fileURLToPath, not .pathname: that one breaks on Windows drives and on folders with spaces.
const publicDir = fileURLToPath(new URL("../public", import.meta.url));

/** Serves the real files under public/, like the app does; anything else is a 404. */
async function staticFiles(url: string): Promise<Response> {
  try {
    return new Response(readFileSync(publicDir + url, "utf8"), { status: 200 });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

const answering = (body: string, status = 200) => async () => new Response(body, { status });

describe("loadLibrary", () => {
  it("loads and validates the real index.json", async () => {
    const library = await loadLibrary(staticFiles);
    expect(library.ok).toBe(true);
    if (library.ok) expect(library.data.map((manual) => manual.id)).toContain("kallax");
  });

  it("reports a network failure in plain words", async () => {
    const library = await loadLibrary(async () => {
      throw new TypeError("fetch failed");
    });
    expect(library).toEqual({ ok: false, errors: ["Couldn't load The manual library. Check your connection and try again."] });
  });

  it("reports a file that is not JSON", async () => {
    const library = await loadLibrary(answering("<html>oops</html>"));
    expect(library).toEqual({ ok: false, errors: ["The manual library is not valid JSON (/manuals/index.json)."] });
  });

  it("lists every schema problem", async () => {
    const library = await loadLibrary(answering(JSON.stringify([{ id: "kallax", title: 5 }])));
    expect(library.ok).toBe(false);
    if (!library.ok) {
      expect(library.errors[0]).toMatch(/^The manual library has \d+ problems/);
      expect(library.errors.some((error) => error.startsWith("0.title:"))).toBe(true);
      expect(library.errors.some((error) => error.startsWith("0.stepCount:"))).toBe(true);
    }
  });
});

describe("loadManual", () => {
  it("loads and validates the real KALLAX manual.json", async () => {
    const manual = await loadManual("kallax", staticFiles);
    expect(manual.ok).toBe(true);
    if (manual.ok) expect(manual.data.steps).toHaveLength(19);
  });

  it("says when a manual does not exist", async () => {
    expect(await loadManual("billy", staticFiles)).toEqual({
      ok: false,
      errors: ['The manual "billy" was not found (/manuals/billy/manual.json).'],
    });
  });

  it("rejects an unsafe id without fetching", async () => {
    let fetched = false;
    const manual = await loadManual("../secrets", async () => {
      fetched = true;
      return new Response("{}");
    });
    expect(manual).toEqual({ ok: false, errors: ['"../secrets" is not a valid manual id.'] });
    expect(fetched).toBe(false);
  });

  it("rejects a file whose id does not match its folder", async () => {
    const kallax = readFileSync(`${publicDir}/manuals/kallax/manual.json`, "utf8");
    const manual = await loadManual("lack", answering(kallax));
    expect(manual).toEqual({ ok: false, errors: ['The file for "lack" says it is the manual "kallax".'] });
  });

  it("lists the problems in a corrupted manual", async () => {
    const broken = JSON.parse(readFileSync(`${publicDir}/manuals/kallax/manual.json`, "utf8"));
    broken.steps[0].step.actions[0].verb = "glue";
    delete broken.layout;
    const manual = await loadManual("kallax", answering(JSON.stringify(broken)));
    expect(manual.ok).toBe(false);
    if (!manual.ok) expect(manual.errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe("manualBaseUrl", () => {
  it("is the folder the crops are relative to", () => {
    expect(manualBaseUrl("kallax")).toBe("/manuals/kallax/");
  });
});

describe("sceneManualFor (temporary until AJI-03)", () => {
  it("gives the KALLAX scene for the KALLAX manual", async () => {
    const saved = await loadManual("kallax", staticFiles);
    if (!saved.ok) throw new Error("fixture missing");
    const scene = sceneManualFor(saved.data);
    expect(scene.ok).toBe(true);
    if (scene.ok) expect(scene.manual.steps).toHaveLength(saved.data.steps.length);
  });

  it("explains that other manuals can't be opened yet", async () => {
    const saved = await loadManual("kallax", staticFiles);
    if (!saved.ok) throw new Error("fixture missing");
    expect(sceneManualFor({ ...saved.data, id: "lack", title: "LACK side table" })).toEqual({
      ok: false,
      errors: ['The 3D scene for "LACK side table" can\'t be built yet. Only KALLAX can be opened for now.'],
    });
  });
});
