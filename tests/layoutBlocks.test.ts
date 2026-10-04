import { describe, expect, it } from "vitest";
import { hardwareScaleFor } from "@/scene/constants";
import { checkConsistency } from "@/scene/consistency";
import { add, rotate } from "@/scene/geometry";
import { snapLayout } from "@/scene/layout";
import { resolveScene } from "@/scene/resolveScene";
import { buildTracks } from "@/scene/tracks";
import type { Action, AiPart, PartsLayout, SceneManual, Vec3 } from "@/scene/types";

// Made-up furniture shaped like the two other demo manuals, until their real data exists:
// a LACK-like table (thick top, four square legs) and a MALM-like chest (frame plus drawers).
type Piece = { id: string; label: string; kind: AiPart["kind"]; size: Vec3; home: Vec3 };
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The layout call 2 would give for these pieces, each fraction off by up to ±8% of itself.
function roughLayout(pieces: Piece[], build: Vec3, seed?: number): PartsLayout {
  const random = seed === undefined ? undefined : seededRandom(seed);
  const rough = (v: number): number => (random ? v * (1 + (random() * 2 - 1) * 0.08) : v);
  return {
    buildOrientation: "upright",
    parts: pieces.map((p) => ({
      id: p.id, label: p.label, kind: p.kind, count: 1, shape: "box", features: [],
      sizeFrac: p.size.map((v, i) => rough(v / build[i])) as Vec3,
      homeFrac: p.home.map((v, i) => rough(v / build[i])) as Vec3,
    })),
  };
}

function worstErrorCm(pieces: Piece[], build: Vec3, seed?: number): { ok: boolean; errors: string[]; worst: number } {
  const result = snapLayout(roughLayout(pieces, build, seed), build);
  let worst = 0;
  for (const piece of pieces) {
    const part = result.parts.find((p) => p.id === piece.id);
    for (let i = 0; i < 3; i++) {
      worst = Math.max(worst, Math.abs((part?.sizeCm?.[i] ?? NaN) - piece.size[i]), Math.abs((part?.homeCm?.[i] ?? NaN) - piece.home[i]));
    }
  }
  return { ok: result.ok, errors: result.errors, worst };
}

const TABLE: Vec3 = [55, 45, 55];
const table = (upsideDown: boolean): Piece[] => [
  { id: "top", label: "Table top", kind: "panel", size: [55, 5, 55], home: [27.5, upsideDown ? 2.5 : 42.5, 27.5] },
  ...[[2.5, 2.5], [52.5, 2.5], [2.5, 52.5], [52.5, 52.5]].map(([x, z], i): Piece => ({
    id: `leg_${i + 1}`, label: `Leg ${i + 1}`, kind: "leg", size: [5, 40, 5], home: [x, upsideDown ? 25 : 20, z],
  })),
];

const CHEST: Vec3 = [80, 100, 48];
const DRAWER_HEIGHT = 96.4 / 3;
const chest: Piece[] = [
  { id: "side_1", label: "Side panel 1", kind: "panel", size: [1.8, 100, 48], home: [0.9, 50, 24] },
  { id: "side_2", label: "Side panel 2", kind: "panel", size: [1.8, 100, 48], home: [79.1, 50, 24] },
  { id: "top", label: "Top panel", kind: "panel", size: [76.4, 1.8, 48], home: [40, 99.1, 24] },
  { id: "bottom", label: "Bottom panel", kind: "panel", size: [76.4, 1.8, 48], home: [40, 0.9, 24] },
  ...[0, 1, 2].map((i): Piece => ({
    id: `drawer_${i + 1}`, label: `Drawer ${i + 1}`, kind: "other", size: [76.4, DRAWER_HEIGHT, 48], home: [40, 1.8 + DRAWER_HEIGHT * (i + 0.5), 24],
  })),
];

describe("snapLayout on a table with a thick top and four legs", () => {
  it.each([["upright", false], ["upside-down", true]] as const)("leaves an exact %s table untouched", (_name, upsideDown) => {
    expect(worstErrorCm(table(upsideDown), TABLE)).toEqual({ ok: true, errors: [], worst: 0 });
  });

  it.each(SEEDS)("snaps ±8% noise back to within 0.5 cm, built upright or upside-down (seed %i)", (seed) => {
    for (const upsideDown of [false, true]) {
      const { ok, errors, worst } = worstErrorCm(table(upsideDown), TABLE, seed);
      expect(errors).toEqual([]);
      expect(ok).toBe(true);
      expect(worst).toBeLessThanOrEqual(0.5);
    }
  });

  it("treats the 5 cm top as a board and gives all four legs one size", () => {
    const { parts } = snapLayout(roughLayout(table(false), TABLE, 3), TABLE);
    expect(parts.find((p) => p.id === "top")?.sizeCm).toEqual([55, 5, 55]);
    const legs = parts.filter((p) => p.kind === "leg").map((p) => p.sizeCm);
    for (const leg of legs) expect(leg).toEqual(legs[0]);
    expect(legs[0]?.[1]).toBe(40); // floor to the underside of the top
  });
});

describe("snapLayout on a chest of drawers", () => {
  it("leaves an exact chest untouched", () => {
    const { ok, errors, worst } = worstErrorCm(chest, CHEST);
    expect({ ok, errors }).toEqual({ ok: true, errors: [] });
    expect(worst).toBeLessThan(0.001);
  });

  it.each(SEEDS)("always gives a sound layout from ±8% noise: no overlaps, nothing floating (seed %i)", (seed) => {
    const { ok, errors, worst } = worstErrorCm(chest, CHEST, seed);
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
    // Which thin board runs through at a corner is a 1.8 cm difference, well under the noise,
    // so a part may be off by up to two board thicknesses. Nothing is off by more than that.
    expect(worst).toBeLessThanOrEqual(2 * 1.8 + 1);
  });

  it.each(SEEDS)("stacks the drawers edge to edge in equal heights (seed %i)", (seed) => {
    const { parts } = snapLayout(roughLayout(chest, CHEST, seed), CHEST);
    const drawers = parts.filter((p) => p.kind === "other").sort((a, b) => (a.homeCm?.[1] ?? 0) - (b.homeCm?.[1] ?? 0));
    const heights = drawers.map((d) => d.sizeCm?.[1] ?? NaN);
    for (const h of heights) expect(h).toBeCloseTo(heights[0], 3);
    for (let i = 1; i < drawers.length; i++) {
      const below = (drawers[i - 1].homeCm?.[1] ?? NaN) + heights[i - 1] / 2;
      const above = (drawers[i].homeCm?.[1] ?? NaN) - heights[i] / 2;
      expect(above).toBeCloseTo(below, 3);
    }
  });

  it("does not force drawers of different heights to match", () => {
    const mixed = chest.map((p): Piece => (p.id === "drawer_1" ? { ...p, size: [76.4, 16, 48], home: [40, 9.8, 24] } : p));
    const { parts } = snapLayout(roughLayout(mixed, CHEST), CHEST);
    expect(parts.find((p) => p.id === "drawer_1")?.sizeCm?.[1]).toBeCloseTo(16);
    expect(parts.find((p) => p.id === "drawer_2")?.sizeCm?.[1]).toBeCloseTo(DRAWER_HEIGHT);
  });
});

describe("the scene on these layouts", () => {
  const assembly = (actions: Action[][]) => actions.map((list, i) => ({
    stepNumber: i + 1, kind: "assembly" as const, instruction: "A step of the test manual.", actions: list, confidence: "high" as const,
  }));
  const place = (part: string, target: string, face: Action["face"]): Action => ({ verb: "place", part, count: 1, target, face });

  it("builds the table upside-down, then turns it over onto its legs", () => {
    const { parts, ok } = snapLayout(roughLayout(table(true), TABLE, 5), TABLE);
    const manual: SceneManual = {
      id: "table", title: "Table", buildSizeCm: TABLE, buildOrientation: "upside-down", parts,
      steps: assembly([
        ...[1, 2, 3, 4].map((n) => [place(`leg_${n}`, "top", "top")]),
        [{ verb: "flip", part: "assembly", count: 1, flipMode: "turn-over" }],
      ]),
    };
    expect(ok).toBe(true);
    expect(checkConsistency(manual)).toEqual([]);
    const end = resolveScene(manual, manual.steps.length - 1);
    expect(end.warnings).toEqual([]);
    expect(end.placed.size).toBe(5);
    const topY = add(rotate([27.5, 2.5, 27.5], end.assembly.quaternion), end.assembly.position)[1];
    expect(topY).toBeCloseTo(42.5); // the top ends on top
    for (let i = 0; i < manual.steps.length; i++) {
      expect(buildTracks(manual, resolveScene(manual, i - 1), resolveScene(manual, i)).tracks.length).toBeGreaterThan(0);
    }
  });

  it("slides finished drawers into the chest after a sub-assembly step", () => {
    const { parts, ok } = snapLayout(roughLayout(chest, CHEST, 5), CHEST);
    const built = assembly([
      [place("side_1", "bottom", "left"), place("side_2", "bottom", "right"), place("top", "side_1", "right")],
      [],
      [1, 2, 3].map((n) => place(`drawer_${n}`, "side_1", "right")),
    ]);
    const steps: SceneManual["steps"] = [built[0], { ...built[1], kind: "subassembly", instruction: "The 3 drawers are assembled separately." }, built[2]];
    const manual: SceneManual = { id: "chest", title: "Chest", buildSizeCm: CHEST, buildOrientation: "upright", parts, steps };
    expect(ok).toBe(true);
    expect(checkConsistency(manual)).toEqual([]);
    expect(resolveScene(manual, 1).placed).toEqual(resolveScene(manual, 0).placed); // the card step moves nothing
    const end = resolveScene(manual, 2);
    expect(end.warnings).toEqual([]);
    expect([...end.placed.values()].filter((p) => p.kind === "other")).toHaveLength(3);
    expect(buildTracks(manual, resolveScene(manual, 1), end).tracks.map((t) => t.id)).toEqual(["drawer_1#1", "drawer_2#1", "drawer_3#1"]);
  });
});

describe("hardwareScaleFor", () => {
  it("keeps KALLAX at 2.5 and draws hardware smaller on smaller furniture, within limits", () => {
    expect(hardwareScaleFor([147, 39, 77])).toBeCloseTo(2.5);
    expect(hardwareScaleFor([80, 100, 48])).toBeCloseTo(2.5 * (100 / 147));
    expect(hardwareScaleFor(TABLE)).toBe(1.25); // would be 0.94; held at the smallest readable size
    expect(hardwareScaleFor([60, 236, 58])).toBe(3.2);
    expect(hardwareScaleFor(undefined)).toBe(2.5);
    expect(hardwareScaleFor([Number.NaN, -1, 0])).toBe(2.5);
  });
});
