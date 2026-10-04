import { describe, expect, it } from "vitest";
import { cornersOf, fitDistance, type Bounds } from "@/scene/geometry";
import type { Vec3 } from "@/scene/types";

const FOV = (30 * Math.PI) / 180;
const VIEW: Vec3 = [-0.6, 1, 1.2]; // the scene's view of a build lying on the floor

// Where a corner lands in the picture, as fractions of half its width and height (±1 = the edge).
function onScreen(bounds: Bounds, view: Vec3, distance: number, aspect: number): [number, number][] {
  const length = Math.hypot(...view);
  const d = view.map((v) => v / length);
  const right = [d[2], 0, -d[0]].map((v) => v / Math.hypot(d[2], d[0]));
  const up = [d[1] * right[2] - d[2] * right[1], d[2] * right[0] - d[0] * right[2], d[0] * right[1] - d[1] * right[0]];
  const centre = bounds.min.map((v, i) => (v + bounds.max[i]) / 2);
  return cornersOf(bounds).map((corner) => {
    const rel = corner.map((v, i) => v - centre[i]);
    const dot = (a: number[]) => rel[0] * a[0] + rel[1] * a[1] + rel[2] * a[2];
    const depth = distance - dot(d);
    return [dot(right) / (depth * Math.tan(FOV / 2) * aspect), dot(up) / (depth * Math.tan(FOV / 2))];
  });
}

describe("fitDistance", () => {
  const cases: [string, Bounds][] = [
    ["the whole KALLAX lying down", { min: [0, 0, 0], max: [147, 39, 77] }],
    ["one shelf", { min: [37.45, 0, 3.8], max: [39.05, 39, 73.2] }],
    ["a tall standing unit", { min: [0, 0, 0], max: [77, 147, 39] }],
    ["a small table", { min: [0, 0, 0], max: [55, 45, 55] }],
  ];

  it.each(cases)("puts every corner of %s inside the picture, with one touching its edge", (_name, bounds) => {
    for (const aspect of [0.6, 1, 1.8]) {
      const corners = onScreen(bounds, VIEW, fitDistance(bounds, VIEW, FOV, aspect), aspect);
      const furthest = Math.max(...corners.flat().map(Math.abs));
      expect(furthest).toBeLessThanOrEqual(1 + 1e-9);
      expect(furthest).toBeCloseTo(1, 5); // no closer than it has to be
    }
  });

  it("stands further back for a bigger box and for a narrower picture", () => {
    const small: Bounds = { min: [0, 0, 0], max: [30, 30, 30] };
    const big: Bounds = { min: [0, 0, 0], max: [200, 200, 200] };
    expect(fitDistance(big, VIEW, FOV, 1.5)).toBeGreaterThan(fitDistance(small, VIEW, FOV, 1.5) * 5);
    expect(fitDistance(big, VIEW, FOV, 0.5)).toBeGreaterThan(fitDistance(big, VIEW, FOV, 1.5));
  });

  it("copes with a box of no size", () => {
    expect(fitDistance({ min: [5, 5, 5], max: [5, 5, 5] }, VIEW, FOV, 1)).toBe(0);
  });
});
