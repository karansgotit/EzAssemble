import type { Vec3 } from "./types";

// An axis-aligned box in the build frame, in cm.
export interface Extent {
  id: string;
  lo: number[];
  hi: number[];
}

// Rounding and float fuzz below this are not real overlaps or gaps.
export const SLACK_CM = 0.2;

const AXES = [0, 1, 2];
const cm = (n: number): string => `${Math.round(n * 10) / 10} cm`;

// Negative = the two boxes overlap on this axis by that much; positive = the gap between them.
const separation = (p: Extent, q: Extent, axis: number): number =>
  Math.max(p.lo[axis], q.lo[axis]) - Math.min(p.hi[axis], q.hi[axis]);

function touches(p: Extent, q: Extent): boolean {
  const seps = AXES.map((axis) => separation(p, q, axis));
  // Face contact: close on every axis, and sharing real area on at least two of them.
  return seps.every((s) => s <= SLACK_CM) && seps.filter((s) => s < -SLACK_CM).length >= 2;
}

// Step 6 of snapLayout. Each message is one plain sentence, because it is sent back to call 2.
export function validateLayout(items: Extent[], buildSizeCm: Vec3): string[] {
  const errors: string[] = [];

  for (const p of items) {
    const over = Math.max(...AXES.map((axis) => Math.max(-p.lo[axis], p.hi[axis] - buildSizeCm[axis])));
    if (over > SLACK_CM) errors.push(`${p.id} sticks out of the product box by ${cm(over)}`);
  }

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const depth = Math.min(...AXES.map((axis) => -separation(items[i], items[j], axis)));
      if (depth > SLACK_CM) errors.push(`${items[i].id} overlaps ${items[j].id} by ${cm(depth)}`);
    }
  }

  if (items.length > 1) {
    for (const p of items) {
      if (!items.some((q) => q !== p && touches(p, q))) errors.push(`${p.id} does not touch any other part`);
    }
  }

  return errors;
}
