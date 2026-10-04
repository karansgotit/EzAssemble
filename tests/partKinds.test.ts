import { describe, expect, it } from "vitest";
import { HARDWARE_SCALE } from "@/scene/constants";
import { cylinderIn, rotate } from "@/scene/geometry";
import { hardwareMotion, resolveScene } from "@/scene/resolveScene";
import { buildTracks, sample } from "@/scene/tracks";
import type { Action, PartKind, SceneManual, ScenePart, Vec3 } from "@/scene/types";

// A 40 × 3 × 30 base panel on the floor; hardware goes into its top face (the plane y = 3).
const TOP = 3;
const solid = (id: string, kind: PartKind, shape: "box" | "cylinder", sizeCm: Vec3, homeCm: Vec3): ScenePart => ({
  id, label: id, kind, count: 1, shape, sizeCm, homeCm, features: [],
});
const hardware = (kind: PartKind): ScenePart => ({
  id: kind, label: kind, kind, count: 8, shape: "cylinder", hardwareMm: { length: 30, diameter: 8 }, features: [],
});
const LENGTH = (30 / 10) * HARDWARE_SCALE;

const parts: ScenePart[] = [
  solid("base", "panel", "box", [40, 3, 30], [20, 1.5, 15]),
  solid("leg_box", "leg", "box", [4, 20, 4], [2, 13, 2]),
  solid("leg_round", "leg", "cylinder", [4, 20, 4], [38, 13, 2]),
  solid("drawer", "other", "box", [20, 10, 20], [20, 8, 15]),
  ...(["dowel", "screw", "camBolt", "cam", "nail"] as const).map(hardware),
];

function manualOf(...steps: Action[][]): SceneManual {
  return {
    id: "kinds", title: "Kinds", buildSizeCm: [40, 23, 30], buildOrientation: "upright", parts,
    steps: steps.map((actions, i) => ({ stepNumber: i + 1, kind: "assembly", instruction: "A step of the test manual.", actions, confidence: "high" })),
  };
}
const into = (part: string, verb: Action["verb"] = "insert", extra: Partial<Action> = {}): Action =>
  ({ verb, part, count: 1, target: "base", face: "top", at: "middle", ...extra });
const onto = (part: string, verb: "place" | "attach" = "place"): Action => ({ verb, part, count: 1, target: "base", face: "top" });

// The scene and tracks for the last step of a manual built from these steps.
function play(...steps: Action[][]) {
  const manual = manualOf(...steps);
  const before = resolveScene(manual, steps.length - 2);
  const after = resolveScene(manual, steps.length - 1);
  return { after, ...buildTracks(manual, before, after) };
}

describe("hardware kinds", () => {
  it("leaves a dowel half sunk and drives everything else in flush", () => {
    expect(play([into("dowel")]).after.placed.get("dowel#1")?.position).toEqual([20, TOP, 15]);
    for (const kind of ["screw", "camBolt", "cam", "nail"]) {
      const piece = play([into(kind)]).after.placed.get(`${kind}#1`);
      expect(piece?.position[1], kind).toBeCloseTo(TOP - LENGTH / 2); // outer end level with the face
      expect(rotate([0, 1, 0], piece?.quaternion ?? [0, 0, 0, 1])[1], kind).toBeCloseTo(1); // along the face normal
    }
  });

  it("turns screws and cam bolts in three full turns, whichever verb the step used", () => {
    expect([hardwareMotion("screw"), hardwareMotion("camBolt")]).toEqual(["screw", "screw"]);
    for (const kind of ["screw", "camBolt"]) {
      for (const verb of ["screw", "insert"] as const) {
        const { tracks, totalDuration } = play([into(kind, verb)]);
        expect(tracks[0].verb).toBe("screw");
        expect(tracks[0].duration).toBe(1.4);
        const spin = (t: number) => sample(tracks, t).get(`${kind}#1`)?.spin ?? NaN;
        expect(spin(totalDuration) - spin(0), `${kind} via ${verb}`).toBeCloseTo(3 * 2 * Math.PI);
      }
    }
  });

  it("pushes dowels, cams and nails straight in with no turning, whichever verb the step used", () => {
    for (const kind of ["dowel", "cam", "nail"]) {
      for (const verb of ["insert", "screw"] as const) {
        const { tracks, totalDuration } = play([into(kind, verb)]);
        const [track] = tracks;
        expect(track.verb, kind).toBe("insert");
        expect(track.from.position[1] - track.to.position[1]).toBeCloseTo(6); // straight down the normal
        expect(track.from.position[0]).toBe(track.to.position[0]);
        expect(sample(tracks, totalDuration).get(track.id)?.spin).toBe(0);
        expect(sample(tracks, 0).get(track.id)?.spin).toBe(0);
      }
    }
  });

  it("locks a cam with a quarter turn and no travel", () => {
    const { after, tracks, totalDuration } = play([into("cam", "insert", { count: 2, at: "all" })], [into("cam", "lock", { count: 2 })]);
    expect(tracks.map((t) => t.id)).toEqual(["cam#1", "cam#2"]);
    for (const track of tracks) {
      expect(track.verb).toBe("lock");
      expect(track.from.position).toEqual(track.to.position);
      expect(sample(tracks, totalDuration).get(track.id)?.spin).toBeCloseTo(Math.PI / 2);
      expect(sample(tracks, 0).get(track.id)?.spin).toBeCloseTo(0);
    }
    expect([...after.placed.values()].filter((p) => p.kind === "cam")).toHaveLength(2); // no new pieces
  });
});

describe("non-hardware kinds", () => {
  it.each(["leg_box", "leg_round", "drawer"])("places %s at its home, arriving along the target face's normal", (id) => {
    for (const verb of ["place", "attach"] as const) {
      const { after, tracks } = play([onto("base")], [onto(id, verb)]);
      const part = parts.find((p) => p.id === id);
      const piece = after.placed.get(`${id}#1`);
      expect(piece?.position).toEqual(part?.homeCm);
      expect(piece?.size).toEqual(part?.sizeCm);
      const [track] = tracks;
      expect(track.verb).toBe(verb);
      expect(track.from.position[1] - track.to.position[1]).toBeCloseTo((part?.sizeCm?.[1] ?? NaN) * 0.35 + 10);
      expect(track.from.position[0]).toBe(track.to.position[0]);
    }
  });

  it("stands a round leg along the longest side of the box it fills", () => {
    expect(cylinderIn([4, 20, 4])).toEqual({ axis: 1, radius: 2, length: 20 });
    expect(cylinderIn([45, 5, 6])).toEqual({ axis: 0, radius: 2.5, length: 45 }); // lying along x
  });
});

describe("the 'at' fallback, when an action names no 'for' part", () => {
  const xs = (at: Action["at"], count: number): number[] =>
    [...play([into("dowel", "insert", { at, count })]).after.placed.values()].filter((p) => p.kind === "dowel").map((p) => p.position[0]);

  it("puts one piece at 15%, 50% or 85% of the face's long side", () => {
    expect(xs("start", 1)[0]).toBeCloseTo(40 * 0.15);
    expect(xs("middle", 1)[0]).toBeCloseTo(40 * 0.5);
    expect(xs("end", 1)[0]).toBeCloseTo(40 * 0.85);
    expect(xs("all", 1)[0]).toBeCloseTo(40 * 0.5);
    expect(xs(undefined, 1)[0]).toBeCloseTo(40 * 0.5);
  });

  it("keeps several pieces apart instead of stacking them on one spot", () => {
    [[0.15, 0.85], [0.05, 0.25], [0.4, 0.6], [0.75, 0.95]].forEach(([from, to], i) => {
      const [a, b] = xs((["all", "start", "middle", "end"] as const)[i], 2);
      expect(a).toBeCloseTo(40 * from);
      expect(b).toBeCloseTo(40 * to);
    });
    for (const p of play([into("dowel", "insert", { at: "all", count: 3 })]).after.placed.values()) {
      if (p.kind === "dowel") expect(p.position[2]).toBeCloseTo(15); // centred across the short side
    }
  });
});
