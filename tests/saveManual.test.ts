import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/save-manual/route";
import { saveToLibrary } from "@/app/api/save-manual/saveToLibrary";
import { loadLibrary, loadManual } from "@/client/loadManual";
import { buildSceneManual } from "@/scene/buildSceneManual";
import { LibraryIndex, type SavedManual } from "@/schema";
import { saved as gold } from "./helpers/schemaFixtures";

const JPEG = "/9j/4AAQSkZJRgABAQ=="; // a few real JPEG header bytes
const manual: SavedManual = { ...gold, id: "test-shelf", title: "Test shelf" };
const crops = manual.steps.flatMap((step) => (step.status === "subassembly" ? [] : [{ name: step.crop.replace("crops/", ""), base64: JPEG }]));

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "ezassemble-library-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

/** Serves the temporary library the way the app serves public/manuals/. */
const serve = async (url: string) => {
  const file = path.join(dir, url.replace("/manuals/", ""));
  return existsSync(file) ? new Response(readFileSync(file, "utf8")) : new Response("", { status: 404 });
};

describe("saveToLibrary", () => {
  it("writes manual.json, every crop and the index entry", async () => {
    expect(await saveToLibrary({ manual, crops }, dir)).toEqual({ ok: true, path: "public/manuals/test-shelf/manual.json" });
    expect(JSON.parse(readFileSync(path.join(dir, "test-shelf/manual.json"), "utf8"))).toEqual(manual);
    expect(readFileSync(path.join(dir, "test-shelf/crops/step-01.jpg")).subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(LibraryIndex.parse(JSON.parse(readFileSync(path.join(dir, "index.json"), "utf8")))).toEqual([
      { id: "test-shelf", title: "Test shelf", stepCount: 19, thumbnail: "crops/step-01.jpg", createdAt: manual.createdAt },
    ]);
  });

  it("can be loaded back and played with no AI call (FR-19)", async () => {
    await saveToLibrary({ manual, crops }, dir);
    const library = await loadLibrary(serve);
    const loaded = await loadManual("test-shelf", serve);
    expect(library.ok && library.data.map((entry) => entry.id)).toEqual(["test-shelf"]);
    if (!loaded.ok) throw new Error(loaded.errors.join("; "));
    const { manual: scene, layoutErrors } = buildSceneManual(loaded.data, "/manuals/test-shelf/");
    expect(layoutErrors).toEqual([]);
    expect(scene.steps).toHaveLength(19);
    expect(scene.steps[0].crop).toBe("/manuals/test-shelf/crops/step-01.jpg");
  });

  it("keeps the other manuals in the index and replaces its own entry", async () => {
    writeFileSync(path.join(dir, "index.json"), JSON.stringify([{ id: "kallax", title: "KALLAX 2×4", stepCount: 19, thumbnail: "crops/step-01.jpg", createdAt: "2026-10-04T00:00:00Z" }]));
    await saveToLibrary({ manual, crops }, dir);
    await saveToLibrary({ manual: { ...manual, title: "Test shelf v2" }, crops }, dir);
    const index = LibraryIndex.parse(JSON.parse(readFileSync(path.join(dir, "index.json"), "utf8")));
    expect(index.map((entry) => [entry.id, entry.title])).toEqual([["kallax", "KALLAX 2×4"], ["test-shelf", "Test shelf v2"]]);
  });

  it("refuses crop names that could write outside the manual's folder", async () => {
    for (const name of ["../../evil.jpg", "crops/step-01.jpg", "step-01.png", "/etc/passwd", "step-1.jpg"]) {
      const outcome = await saveToLibrary({ manual, crops: [...crops, { name, base64: JPEG }] }, dir);
      expect(outcome.ok).toBe(false);
    }
    expect(existsSync(path.join(dir, "test-shelf"))).toBe(false);
  });

  it("refuses a crop that is not a JPEG, and a manual with a step image missing", async () => {
    expect(await saveToLibrary({ manual, crops: [{ ...crops[0], base64: "aGVsbG8=" }, ...crops.slice(1)] }, dir)).toEqual({ ok: false, error: "step-01.jpg is not a JPEG image." });
    expect(await saveToLibrary({ manual, crops: crops.slice(1) }, dir)).toEqual({ ok: false, error: "Missing the image for crops/step-01.jpg." });
    expect(existsSync(path.join(dir, "index.json"))).toBe(false);
  });
});

describe("POST /api/save-manual", () => {
  const request = (body: unknown) => new Request("http://localhost/api/save-manual", { method: "POST", body: JSON.stringify(body) });

  it("answers 404 outside development, without reading the body", async () => {
    for (const env of ["production", "test"]) {
      vi.stubEnv("NODE_ENV", env);
      expect((await POST(request({ manual, crops }))).status).toBe(404);
    }
  });

  it("answers 400 for a body that is not a SaveManualRequest", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const response = await POST(request({ manual: { ...manual, id: "Not A Valid Id" }, crops }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false });
  });
});
