import { readFile } from "node:fs/promises";
import path from "node:path";
import { deriveTraps } from "@/scene/traps";
import type { SceneManual } from "@/scene/types";
import { SceneDevClient } from "./SceneDevClient";

// Dev-only page: plays fixtures/<fixture>.scene.json in <AssemblyScene>. Read per request, so the
// app still builds while that fixture does not exist yet (KAR-02).
export const dynamic = "force-dynamic";

async function loadFixture(name: string): Promise<SceneManual | string> {
  if (!/^[a-z0-9-]{1,40}$/.test(name)) return `"${name}" is not a valid fixture name.`;
  try {
    const file = path.join(process.cwd(), "fixtures", `${name}.scene.json`);
    const manual = JSON.parse(await readFile(file, "utf8")) as Partial<SceneManual>;
    if (!Array.isArray(manual.parts) || !Array.isArray(manual.steps)) return `fixtures/${name}.scene.json is not a scene manual.`;
    // The fixture holds only the manual's own warnings; add the ones the geometry proves.
    return { ...(manual as SceneManual), steps: deriveTraps(manual.parts, manual.steps) };
  } catch {
    return `fixtures/${name}.scene.json was not found or is not valid JSON.`;
  }
}

// ?step=3&t=1 opens step 3 at the end of its animation, with no controls: used for screenshots.
type Query = { fixture?: string; step?: string; t?: string };

export default async function SceneDevPage({ searchParams }: { searchParams: Promise<Query> }) {
  const { fixture = "kallax", step, t } = await searchParams;
  const manual = await loadFixture(fixture);
  if (typeof manual === "string") {
    return (
      <main className="placeholder">
        <h1>Scene dev page</h1>
        <p>{manual}</p>
      </main>
    );
  }
  const startStep = Math.max(1, Math.min(manual.steps.length, Math.round(Number(step)) || 1));
  const startT = t === undefined || !Number.isFinite(Number(t)) ? null : Math.max(0, Math.min(1, Number(t)));
  return <SceneDevClient manual={manual} startStep={startStep} startT={startT} />;
}
