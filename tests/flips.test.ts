import { describe, expect, it } from "vitest";
import { NO_ROTATION, add, cornersOf, rotate, sameRotation, uprightRotation } from "@/scene/geometry";
import { assemblyBounds, resolveScene, type AssemblyPose } from "@/scene/resolveScene";
import { buildTracks, sample } from "@/scene/tracks";
import type { Action, BuildOrientation, SceneManual, ScenePart, Vec3 } from "@/scene/types";
import { loadKallaxScene } from "./helpers/kallaxScene";

const panel = (id: string, sizeCm: Vec3, homeCm: Vec3): ScenePart => ({
  id, label: id, kind: "panel", count: 1, shape: "box", sizeCm, homeCm, features: [],
});
const place = (part: string, target?: string): Action => ({ verb: "place", part, count: 1, target, face: target ? "top" : undefined });
const flip = (flipMode: "stand-up" | "turn-over"): Action => ({ verb: "flip", part: "assembly", count: 1, flipMode });

// A manual that builds `parts` in one step, then does one flip per following step.
function manualOf(buildOrientation: BuildOrientation, buildSizeCm: Vec3, parts: ScenePart[], flips: Action[]): SceneManual {
  const build = parts.map((p, i) => place(p.id, i === 0 ? undefined : parts[0].id));
  const steps = [build, ...flips.map((f) => [f])].map((actions, i) => ({
    stepNumber: i + 1, kind: "assembly" as const, instruction: "A step of the test manual.", actions, confidence: "high" as const,
  }));
  return { id: "test", title: "Test", buildSizeCm, buildOrientation, parts, steps };
}

const inWorld = (pose: AssemblyPose) => (p: Vec3): Vec3 => add(rotate(p, pose.quaternion), pose.position);
const lowestCorner = (manual: SceneManual, pose: AssemblyPose): number =>
  Math.min(...cornersOf({ min: [0, 0, 0], max: manual.buildSizeCm }).map((c) => inWorld(pose)(c)[1]));
const endPose = (manual: SceneManual): AssemblyPose => resolveScene(manual, manual.steps.length - 1).assembly;

// A 60 wide × 100 tall × 30 deep cabinet lying on its side: height along x, top at x = 0.
const cabinetParts = [
  panel("side", [96, 2, 30], [50, 1, 15]),
  panel("top", [2, 60, 30], [1, 30, 15]),
  panel("bottom", [2, 60, 30], [99, 30, 15]),
];
const cabinet = (flips: Action[]) => manualOf("on-side", [100, 60, 30], cabinetParts, flips);

// A 55 × 45 × 55 table built with its top on the floor and its legs in the air.
const tableParts = [panel("top", [55, 5, 55], [27.5, 2.5, 27.5]), panel("leg", [5, 40, 5], [2.5, 25, 2.5])];
const table = (orientation: BuildOrientation, flips: Action[]) => manualOf(orientation, [55, 45, 55], tableParts, flips);

describe("stand-up", () => {
  it("stands an on-back build (KALLAX) up with its front toward the viewer", () => {
    const pose = endPose(loadKallaxScene());
    expect(sameRotation(pose.quaternion, uprightRotation("on-back"))).toBe(true);
    expect(inWorld(pose)([1.9, 19.5, 38.5])[1]).toBeCloseTo(145.1); // E1, the top
    expect(rotate([0, 1, 0], pose.quaternion)[2]).toBeCloseTo(1); // the open front
  });

  it("stands an on-side build up: top end high, front still toward the viewer", () => {
    const manual = cabinet([flip("stand-up")]);
    const pose = endPose(manual);
    expect(inWorld(pose)([1, 30, 15])[1]).toBeCloseTo(99); // top
    expect(inWorld(pose)([99, 30, 15])[1]).toBeCloseTo(1); // bottom
    expect(rotate([0, 0, 1], pose.quaternion)[2]).toBeCloseTo(1); // depth axis unchanged
    expect(rotate([0, 1, 0], pose.quaternion)[0]).toBeCloseTo(1); // width now runs left to right
    expect(lowestCorner(manual, pose)).toBeCloseTo(0);
  });

  it("is the same as turning over for an upside-down build, and nothing for an upright one", () => {
    expect(sameRotation(endPose(table("upside-down", [flip("stand-up")])).quaternion, endPose(table("upside-down", [flip("turn-over")])).quaternion)).toBe(true);
    const upright = endPose(table("upright", [flip("stand-up")]));
    expect(sameRotation(upright.quaternion, NO_ROTATION)).toBe(true);
    upright.position.forEach((v) => expect(v).toBeCloseTo(0));
  });
});

describe("turn-over", () => {
  it("turns an upside-down table over half a turn about x, onto its legs", () => {
    const manual = table("upside-down", [flip("turn-over")]);
    const pose = endPose(manual);
    expect(inWorld(pose)([27.5, 2.5, 27.5])[1]).toBeCloseTo(42.5); // the top is now on top
    expect(inWorld(pose)([2.5, 25, 2.5])[1]).toBeCloseTo(20); // the leg is under it
    expect(rotate([1, 0, 0], pose.quaternion)[0]).toBeCloseTo(1); // x did not move
    expect(lowestCorner(manual, pose)).toBeCloseTo(0);
  });

  it("cancels out when done twice", () => {
    const pose = endPose(table("upside-down", [flip("turn-over"), flip("turn-over")]));
    expect(sameRotation(pose.quaternion, NO_ROTATION)).toBe(true);
    pose.position.forEach((v) => expect(v).toBeCloseTo(0));
  });
});

describe("builds with no flip", () => {
  it("stay in the build frame, whatever their orientation", () => {
    for (const manual of [cabinet([]), table("upside-down", []), table("upright", [])]) {
      expect(endPose(manual)).toEqual({ position: [0, 0, 0], quaternion: NO_ROTATION });
    }
    expect(resolveScene(loadKallaxScene(), 13).assembly.quaternion).toEqual(NO_ROTATION); // before step 15
  });
});

describe("flip animation", () => {
  it.each([
    ["on-side stand-up", cabinet([flip("stand-up")])],
    ["upside-down turn-over", table("upside-down", [flip("turn-over")])],
  ])("keeps the assembly on the floor throughout (%s)", (_name, manual) => {
    const before = resolveScene(manual, 0);
    const after = resolveScene(manual, 1);
    const { tracks } = buildTracks(manual, before, after);
    const corners = cornersOf(assemblyBounds(after, manual));
    for (const t of [0, 0.5, 1, 1.5, 2]) {
      const pose = sample(tracks, t).get("assembly");
      if (!pose) throw new Error("no assembly pose");
      expect(Math.min(...corners.map((c) => inWorld(pose)(c)[1]))).toBeCloseTo(0);
    }
    const end = sample(tracks, 2).get("assembly");
    expect(end && sameRotation(end.quaternion, after.assembly.quaternion)).toBe(true);
  });
});
