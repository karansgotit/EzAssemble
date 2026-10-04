import { describe, expect, it } from "vitest";
import { FACE_NORMALS, add, cornersOf, rotate } from "@/scene/geometry";
import { resolveScene, type Placed } from "@/scene/resolveScene";
import type { SceneManual, Vec3 } from "@/scene/types";
import { loadKallaxScene } from "./helpers/kallaxScene";
import { SceneManual as SceneManualSchema } from "@/schema";

const manual = loadKallaxScene();
const afterStep = (stepNumber: number) => resolveScene(manual, stepNumber - 1);
const piece = (stepNumber: number, id: string): Placed => {
  const found = afterStep(stepNumber).placed.get(id);
  if (!found) throw new Error(`${id} is not placed after step ${stepNumber}`);
  return found;
};
const ofPart = (stepNumber: number, partId: string): Placed[] =>
  [...afterStep(stepNumber).placed.values()].filter((p) => p.partId === partId);

describe("resolveScene on KALLAX", () => {
  it("starts empty and lays the long panel down as soon as something is built onto it", () => {
    expect(resolveScene(manual, -1).placed.size).toBe(0);
    expect(piece(1, "L1#1").position).toEqual([73.5, 19.5, 1.9]);
    expect(piece(1, "E1#1").position).toEqual([1.9, 19.5, 38.5]);
  });

  it("puts shelf 1 at home and its dowels where it meets the long panel", () => {
    expect(piece(3, "S1#1").position).toEqual([38.25, 19.5, 38.5]);
    const [a, b] = [piece(3, "dowel#3"), piece(3, "dowel#4")];
    for (const dowel of [a, b]) {
      expect(dowel.position[0]).toBeCloseTo(38.25);
      expect(dowel.position[2]).toBeCloseTo(3.8); // half sunk in L1's front face
    }
    expect(a.position[1]).toBeCloseTo(9.75);
    expect(b.position[1]).toBeCloseTo(29.25);
  });

  it("puts the first divider's dowels on the end panel's right face", () => {
    for (const id of ["dowel#1", "dowel#2"]) {
      expect(piece(2, id).position[0]).toBeCloseTo(3.8);
      expect(piece(2, id).position[2]).toBeCloseTo(38.5);
    }
  });

  it("has 22 dowels, 8 screws and 11 panels after step 14", () => {
    expect(ofPart(14, "dowel")).toHaveLength(22);
    expect(ofPart(14, "screw")).toHaveLength(8);
    expect(afterStep(14).placed.size).toBe(41);
    expect(afterStep(14).warnings).toEqual([]);
  });

  it("drives screws in until the head is flush, whatever the hardware scale", () => {
    for (const hardwareScale of [1, 2.5, 5]) {
      const screw = resolveScene(manual, 0, hardwareScale).placed.get("screw#1");
      expect((screw?.position[0] ?? NaN) - (screw?.size[1] ?? NaN) / 2).toBeCloseTo(0);
    }
  });

  it("points every piece of hardware along the face it goes into", () => {
    const state = afterStep(14);
    for (const { action, ids } of state.stepActions.flat()) {
      for (const id of ids) {
        const placed = state.placed.get(id);
        if (placed?.shape !== "cylinder" || !action.face) continue;
        const axis = rotate([0, 1, 0], placed.quaternion);
        FACE_NORMALS[action.face].forEach((n, i) => expect(axis[i]).toBeCloseTo(n));
      }
    }
  });

  it("gives the same state however you got to a step", () => {
    const first = afterStep(3);
    afterStep(19);
    expect(afterStep(3)).toEqual(first);
    expect(first.placed.has("S2#1")).toBe(false);
  });

  it("stands the unit up at step 15: E1 on top, E2 on the floor, front toward the viewer", () => {
    const { assembly } = afterStep(15);
    const world = (p: Vec3): Vec3 => add(rotate(p, assembly.quaternion), assembly.position);
    expect(world([1.9, 19.5, 38.5])[1]).toBeCloseTo(145.1);
    expect(world([145.1, 19.5, 38.5])[1]).toBeCloseTo(1.9);
    expect(rotate([0, 1, 0], assembly.quaternion)[2]).toBeCloseTo(1);
    const lowest = Math.min(...cornersOf({ min: [0, 0, 0], max: [147, 39, 77] }).map((c) => world(c)[1]));
    expect(lowest).toBeCloseTo(0);
    expect(afterStep(19).assembly).toEqual(assembly); // info steps keep the last state
  });
});

describe("resolveScene on bad data", () => {
  const broken = (edit: (m: SceneManual) => void): SceneManual => {
    const copy = structuredClone(manual);
    edit(copy);
    return copy;
  };

  it("skips an action with an unknown id and keeps the rest of the step", () => {
    const state = resolveScene(broken((m) => { m.steps[2].actions[0].target = "nope"; }), 2);
    expect(state.warnings).toEqual(['step 3, action 1: target "nope" is not in the parts list, so it was skipped']);
    expect(state.placed.has("S1#1")).toBe(true);
    expect(state.stepActions[2]).toHaveLength(1);
  });

  it("skips hardware beyond what is in the box", () => {
    const state = resolveScene(broken((m) => { m.steps[1].actions[0].count = 23; }), 1);
    expect(state.warnings[0]).toContain('more "dowel" are used than the 22 in the box');
    expect(state.placed.has("D1#1")).toBe(true);
  });

  it("spreads hardware along the whole face when its 'for' part is somewhere else", () => {
    const state = resolveScene(broken((m) => { m.steps[2].actions[0].for = "E2"; }), 2);
    expect(state.warnings[0]).toContain('"E2" does not sit on that face');
    expect(state.placed.get("dowel#3")?.position[0]).toBeCloseTo(3.8 + 139.4 * 0.15);
    expect(state.placed.get("dowel#4")?.position[0]).toBeCloseTo(3.8 + 139.4 * 0.85);
  });
});

describe("separate solid instances", () => {
  it("places two distinctly identified drawers at different positions", () => {
    const m = SceneManualSchema.parse({
      id: "drawers", title: "Drawers", buildSizeCm: [100, 100, 50], buildOrientation: "upright",
      parts: [20, 60].map((y, i) => ({ id: `drawer_${i + 1}`, label: `Drawer ${i + 1}`, kind: "other", count: 1,
        shape: "box", sizeCm: [80, 30, 40], homeCm: [50, y, 25], features: [] })),
      steps: [{ stepNumber: 1, kind: "assembly", instruction: "Place both drawers.", confidence: "high",
        actions: [1, 2].map(i => ({ verb: "place", part: `drawer_${i}`, count: 1 })) }],
    });
    const state = resolveScene(m, 0);
    expect(state.placed.get("drawer_1#1")?.position).toEqual([50, 20, 25]);
    expect(state.placed.get("drawer_2#1")?.position).toEqual([50, 60, 25]);
    expect(state.warnings).toEqual([]);
  });
  it("skips old repeated-solid data rather than drawing overlapping copies", () => {
    const m = structuredClone(manual);
    m.parts.find(p => p.id === "D1")!.count = 2;
    m.steps[1].actions[1].count = 2;
    const state = resolveScene(m, 1);
    expect(state.placed.has("D1#1")).toBe(false);
    expect(state.warnings.join(" ")).toContain("each solid needs its own id");
  });
});
