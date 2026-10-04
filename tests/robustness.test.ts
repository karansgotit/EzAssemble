import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSceneManual } from "@/scene/buildSceneManual";
import { resolveScene } from "@/scene/resolveScene";
import { buildTracks, sample } from "@/scene/tracks";
import type { Action, SceneManual, SceneStep } from "@/scene/types";
import { forgetWarnings, warnOnce } from "@/scene/warnOnce";
import { loadKallaxScene } from "./helpers/kallaxScene";
import { saved } from "./helpers/schemaFixtures";

const gold = loadKallaxScene();
const corrupted = (edit: (m: SceneManual) => void): SceneManual => {
  const copy = structuredClone(gold);
  edit(copy);
  return copy;
};
// Deliberately wrong values, typed loosely on purpose: this is the data Zod would normally stop.
const bad = (value: unknown) => value as never;

// Resolves, builds tracks for and samples every step; returns the ids that move in each step.
function playAll(manual: SceneManual): { moved: string[][]; warnings: string[] } {
  const moved: string[][] = [];
  const count = Array.isArray(manual?.steps) ? manual.steps.length : 0;
  for (let i = 0; i < count; i++) {
    const { tracks, totalDuration } = buildTracks(manual, resolveScene(manual, i - 1), resolveScene(manual, i));
    for (const t of [0, totalDuration / 2, totalDuration]) sample(tracks, t);
    moved.push(tracks.map((track) => track.id));
  }
  return { moved, warnings: resolveScene(manual, count - 1).warnings };
}

describe("a deliberately corrupted copy of gold KALLAX", () => {
  const manual = corrupted((m) => {
    m.steps[1].actions[0].part = "no_such_part"; // step 2: unknown part
    m.steps[2].actions[0].target = "no_such_target"; // step 3: unknown target
    m.steps[3].actions[0].for = "no_such_for"; // step 4: unknown for
    delete m.parts.find((p) => p.id === "D2")!.homeCm; // step 5 places D2: missing geometry
    m.steps[5].actions[0].count = 50; // step 6: more dowels than the box holds
    m.steps[6].actions[0].face = bad("sideways"); // step 7: not a face
    m.steps[7].actions[0].verb = bad("glue"); // step 8: not a verb
    m.steps[8].actions[0].count = bad(Number.NaN); // step 9: not a count
    m.steps[9].actions[0] = bad(null); // step 10: not an action at all
    m.parts.find((p) => p.id === "screw")!.hardwareMm = bad({ length: -5, diameter: "wide" }); // steps 1 and 14
  });

  it("plays every step without throwing", () => {
    expect(() => playAll(manual)).not.toThrow();
  });

  it("skips exactly the broken actions and says why, once each", () => {
    const { warnings } = playAll(manual);
    const expected = [
      'step 1, action 1: hardware "screw" has no size',
      'step 2, action 1: part "no_such_part" is not in the parts list',
      'step 3, action 1: target "no_such_target" is not in the parts list',
      'step 4, action 1: "no_such_for" (for) is not in the parts list',
      'step 5, action 1: part "D2" has no size or position',
      'step 6, action 1: more "dowel" are used than the 22 in the box',
      'step 7, action 1: "sideways" is not a known face',
      'step 8, action 1: "glue" is not a known verb',
      "step 9, action 1: NaN is not a usable count",
      'step 10, action 1: "undefined" is not a known verb',
    ];
    for (const start of expected) expect(warnings.filter((w) => w.startsWith(start)), start).toHaveLength(1);
  });

  it("still animates the valid actions in the same steps", () => {
    const { moved } = playAll(manual);
    expect(moved[0]).toEqual(["E1#1", "E2#1"]); // step 1: the screws are skipped, both end panels still move
    expect(moved[1]).toEqual(["D1#1"]); // step 2: the dowels are skipped, the divider still slides on
    expect(moved[2]).toEqual(["S1#1"]);
    expect(moved[5]).toEqual(["S2#1"]);
    expect(moved[8]).toEqual(["S3#1"]);
    expect(moved[12]).toEqual(["L2#1"]); // an untouched step plays in full
    expect(moved[14]).toEqual(["assembly"]);
  });
});

describe("steps that have nothing to animate", () => {
  it.each(["info", "subassembly", "failed"] as const)("gives a %s step no tracks and keeps the previous state", (kind) => {
    // Even if such a step wrongly carries actions, they are not played.
    const stray: Action = { verb: "place", part: "S2", count: 1, target: "L1", face: "front" };
    const manual = corrupted((m) => {
      m.steps[3] = { stepNumber: 4, kind, instruction: "Nothing moves in this step.", actions: [stray], confidence: "high" } as SceneStep;
    });
    const before = resolveScene(manual, 2);
    const after = resolveScene(manual, 3);
    expect(buildTracks(manual, before, after)).toEqual({ tracks: [], totalDuration: 0.4 });
    expect(after.placed).toEqual(before.placed);
    expect(after.assembly).toEqual(before.assembly);
    expect(after.warnings).toEqual([]);
    expect(resolveScene(manual, 4).placed.has("D2#1")).toBe(true); // and the build carries on after it
  });
});

describe("input that is not a scene manual at all", () => {
  it.each([
    ["no parts", { ...gold, parts: bad(undefined) }],
    ["no steps", { ...gold, steps: bad("nineteen") }],
    ["null entries", { ...gold, parts: bad([null, ...gold.parts]), steps: bad([null, ...gold.steps]) }],
    ["no build size", { ...gold, buildSizeCm: bad(undefined) }],
    ["an empty object", bad({})],
    ["null", bad(null)],
  ])("does not throw on %s", (_name, manual: SceneManual) => {
    expect(() => playAll(manual)).not.toThrow();
    expect(() => resolveScene(manual, 5)).not.toThrow();
  });

  it("survives a saved manual corrupted before it is turned into a scene", () => {
    const broken = structuredClone(saved);
    broken.layout.parts[4].homeFrac = bad(["a", "b", "c"]);
    if (broken.steps[2].status === "ok") broken.steps[2].step.actions[0].target = "gone";
    const { manual, layoutErrors } = buildSceneManual(broken, "/manuals/kallax/");
    expect(layoutErrors.length).toBeGreaterThan(0);
    expect(() => playAll(manual)).not.toThrow();
  });
});

describe("randomly damaged manuals", () => {
  // mulberry32, so a failing seed can be replayed.
  const random = (seed: number) => () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const junk = [undefined, null, "", "nope", -1, 0, 1e9, Number.NaN, [], {}, [1, 2], true];

  it("never throws, whatever single values are swapped for junk", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const next = random(seed);
      const pick = <T,>(list: T[]): T => list[Math.floor(next() * list.length)];
      const manual = corrupted((m) => {
        for (let i = 0; i < 6; i++) {
          const step = pick(m.steps);
          const actions: unknown = step.actions; // may already be junk from an earlier swap
          const choice = next() < 0.5 ? pick(m.parts) : next() < 0.5 || !Array.isArray(actions) ? step : pick(actions);
          if (typeof choice !== "object" || choice === null) continue;
          const target = choice as Record<string, unknown>;
          const keys = Object.keys(target);
          if (keys.length > 0) target[pick(keys)] = pick(junk);
        }
      });
      expect(() => playAll(manual), `seed ${seed}`).not.toThrow();
    }
  });
});

describe("warnOnce", () => {
  afterEach(() => {
    forgetWarnings();
    vi.restoreAllMocks();
  });

  it("logs each problem a single time, however often it is reported", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (let replay = 0; replay < 5; replay++) {
      warnOnce("kallax: step 3, action 1: skipped");
      warnOnce("kallax: step 4, action 1: skipped");
    }
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith("[scene] kallax: step 3, action 1: skipped");
  });
});
