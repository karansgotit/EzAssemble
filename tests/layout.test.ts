import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { labelRoot, snapLayout } from "@/scene/layout";
import type { AiPart, PartsLayout, Vec3 } from "@/scene/types";

// The hand-made KALLAX geometry. Read as data, not imported (D-17 allows converting the
// prototype's fixture); switch to fixtures/kallax.scene.json once KAR-02 lands.
type ReferencePart = Omit<AiPart, "sizeFrac" | "homeFrac"> & { sizeCm?: Vec3; homeCm?: Vec3 };
const referencePath = fileURLToPath(new URL("../reference/prototype/src/fixtures/kallax.json", import.meta.url));
const reference = JSON.parse(readFileSync(referencePath, "utf8")) as { parts: ReferencePart[] };

const BUILD_SIZE_CM: Vec3 = [147, 39, 77]; // KALLAX on its back (CONTRACTS §4.1)
const NOISE = 0.08;
const SEEDS = Array.from({ length: 20 }, (_, i) => i + 1);

// mulberry32: small seeded generator, so every run of a seed sees the same noise.
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

// Reference centimetres → the fractions call 2 would give, each value off by up to ±NOISE of itself.
function kallaxLayout(seed?: number): PartsLayout {
  const random = seed === undefined ? undefined : seededRandom(seed);
  const rough = (value: number): number => (random ? value * (1 + (random() * 2 - 1) * NOISE) : value);
  const parts = reference.parts.map(({ sizeCm, homeCm, ...part }): AiPart => {
    if (!sizeCm || !homeCm) return part;
    return {
      ...part,
      sizeFrac: sizeCm.map((cm, i) => rough(cm / BUILD_SIZE_CM[i])) as Vec3,
      homeFrac: homeCm.map((cm, i) => rough(cm / BUILD_SIZE_CM[i])) as Vec3,
    };
  });
  return { buildOrientation: "on-back", parts };
}

// Largest difference in any size or centre coordinate of any panel, in cm.
function worstErrorCm(layout: PartsLayout): number {
  const snapped = new Map(snapLayout(layout, BUILD_SIZE_CM).parts.map((p) => [p.id, p]));
  let worst = 0;
  for (const gold of reference.parts) {
    if (!gold.sizeCm || !gold.homeCm) continue;
    const part = snapped.get(gold.id);
    for (let i = 0; i < 3; i++) {
      worst = Math.max(worst, Math.abs((part?.sizeCm?.[i] ?? NaN) - gold.sizeCm[i]));
      worst = Math.max(worst, Math.abs((part?.homeCm?.[i] ?? NaN) - gold.homeCm[i]));
    }
  }
  return worst;
}

function panel(id: string, sizeFrac: Vec3, homeFrac: Vec3, label = id): AiPart {
  return { id, label, kind: "panel", count: 1, shape: "box", sizeFrac, homeFrac, features: [] };
}

describe("snapLayout on the KALLAX reference", () => {
  it("leaves an already exact layout untouched", () => {
    const result = snapLayout(kallaxLayout(), BUILD_SIZE_CM);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.moves).toEqual([]);
    expect(worstErrorCm(kallaxLayout())).toBeLessThan(0.001);
  });

  it.each(SEEDS)("snaps ±8% noise back to within 0.5 cm (seed %i)", (seed) => {
    const result = snapLayout(kallaxLayout(seed), BUILD_SIZE_CM);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(worstErrorCm(kallaxLayout(seed))).toBeLessThanOrEqual(0.5);
  });

  it("reports how far each panel was moved", () => {
    const { moves } = snapLayout(kallaxLayout(1), BUILD_SIZE_CM);
    expect(moves.map((m) => m.id).sort()).toEqual(["D1", "D2", "D3", "D4", "E1", "E2", "L1", "L2", "S1", "S2", "S3"]);
    for (const move of moves) expect(move.deltaCm).toBeGreaterThan(0);
  });

  it("passes hardware through unchanged, with no geometry", () => {
    const { parts } = snapLayout(kallaxLayout(1), BUILD_SIZE_CM);
    for (const id of ["dowel", "screw"]) {
      expect(parts.find((p) => p.id === id)).toEqual(reference.parts.find((p) => p.id === id));
    }
    expect(parts.map((p) => p.id)).toEqual(reference.parts.map((p) => p.id));
  });

  it("is deterministic", () => {
    expect(snapLayout(kallaxLayout(7), BUILD_SIZE_CM)).toEqual(snapLayout(kallaxLayout(7), BUILD_SIZE_CM));
  });
});

describe("snapLayout on layouts it cannot fix", () => {
  it("says which panels overlap when two shelves are given the same place", () => {
    const layout = kallaxLayout();
    const shelf1 = layout.parts.find((p) => p.id === "S1");
    const shelf2 = layout.parts.find((p) => p.id === "S2");
    if (shelf1 && shelf2) shelf2.homeFrac = shelf1.homeFrac;
    const result = snapLayout(layout, BUILD_SIZE_CM);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("S1 overlaps S2 by 1.6 cm");
  });

  it("says which parts float, overlap or leave the product box", () => {
    const layout: PartsLayout = {
      buildOrientation: "upright",
      parts: [
        panel("floor", [1, 0.018, 1], [0.5, 0.009, 0.5]),
        panel("floating", [0.2, 0.018, 0.2], [0.5, 0.5, 0.5]),
        panel("rail_1", [0.018, 0.3, 0.3], [0.3, 0.3, 0.3], "Rail 1"),
        panel("rail_2", [0.018, 0.3, 0.3], [0.3, 0.3, 0.3], "Rail 2"),
        panel("outside", [0.018, 0.2, 0.2], [1.4, 0.5, 0.5]),
      ],
    };
    const result = snapLayout(layout, [100, 100, 100]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("floating does not touch any other part");
    expect(result.errors).toContain("rail_1 overlaps rail_2 by 1.8 cm");
    expect(result.errors).toContain("outside sticks out of the product box by 40.9 cm");
  });

  it("never throws on missing or broken numbers", () => {
    const broken: PartsLayout = {
      buildOrientation: "upright",
      parts: [
        { id: "no_fractions", label: "Panel", kind: "panel", count: 1, shape: "box", features: [] },
        panel("not_a_number", [Number.NaN, 0.5, 0.5], [0.5, 0.5, 0.5]),
        panel("fine", [1, 0.018, 1], [0.5, 0.009, 0.5]),
      ],
    };
    const result = snapLayout(broken, [100, 100, 100]);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('part "no_fractions" needs a sizeFrac and a homeFrac to be placed');
    expect(result.errors).toContain('part "not_a_number" needs a sizeFrac and a homeFrac to be placed');
    expect(result.parts.find((p) => p.id === "no_fractions")?.sizeCm).toBeUndefined();
    expect(result.parts.find((p) => p.id === "fine")?.sizeCm).toEqual([100, 1.8, 100]);

    expect(snapLayout({ buildOrientation: "upright", parts: [] }, [100, 100, 100]).ok).toBe(true);
    const noSize = snapLayout(kallaxLayout(), [0, 39, 77]);
    expect(noSize.errors).toEqual(["The product size must be three positive numbers."]);
  });
});

describe("labelRoot", () => {
  it("drops numbering and bracketed notes", () => {
    expect(labelRoot("Shelf 1")).toBe("shelf");
    expect(labelRoot("Divider piece 4")).toBe("divider piece");
    expect(labelRoot("End panel (top when upright)")).toBe("end panel");
  });
});
