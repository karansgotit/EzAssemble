import type { Extent } from "./layoutChecks";
import type { AiPart, Vec3 } from "./types";

// One non-hardware part while it is being snapped. `lo`/`hi` are the working faces in cm.
export interface Box extends Extent {
  part: AiPart;
  rawLo: number[]; // the scaled AI estimate; never changed, every snap decision is judged against it
  rawHi: number[];
  thin: number; // axis of the board thickness, or -1 for legs and other blocks
  fixed: boolean; // thin axis already pinned flush to the product box
  root: string; // label without numbering: "Shelf 1" and "Shelf 2" share "shelf"
}

// Which of two crossing boards runs past the other, as "<id>><id>" keys.
export interface Corners {
  passes: Set<string>;
  stops: Set<string>;
}

const AXES = [0, 1, 2];
const EPS = 1e-6;
const sq = (n: number): number => n * n;
const mid = (b: Box, axis: number): number => (b.lo[axis] + b.hi[axis]) / 2;
const rawMid = (b: Box, axis: number): number => (b.rawLo[axis] + b.rawHi[axis]) / 2;
const overlap = (p: Box, q: Box, axis: number): number =>
  Math.min(p.hi[axis], q.hi[axis]) - Math.max(p.lo[axis], q.lo[axis]);
const pairKey = (p: Box, q: Box): string => `${p.part.id}>${q.part.id}`;

// Boards that are the same kind of part lying the same way: Shelf 1/2/3, Divider piece 1–4.
export function groupsOf(boxes: Box[]): Box[][] {
  const groups = new Map<string, Box[]>();
  for (const b of boxes) {
    if (b.thin < 0) continue;
    const key = `${b.root}|${b.thin}`;
    groups.set(key, [...(groups.get(key) ?? []), b]);
  }
  return [...groups.values()];
}

// Where p's end on `axis` meets board q: p's raw face nearest q, and q's two faces seen from p.
function meeting(p: Box, axis: number, q: Box): { raw: number; inner: number; outer: number } {
  const high = Math.abs(p.rawHi[axis] - mid(q, axis)) < Math.abs(p.rawLo[axis] - mid(q, axis));
  return high
    ? { raw: p.rawHi[axis], inner: q.lo[axis], outer: q.hi[axis] }
    : { raw: p.rawLo[axis], inner: q.hi[axis], outer: q.lo[axis] };
}

// Two perpendicular boards whose ends both reach the other's slab (KALLAX: end panel vs long
// panel) cannot both run through. The rough layout decides: least squares on the two readings,
// pooled over every corner between the same two kinds of board so the four corners agree.
export function decideCorners(boxes: Box[], size: Vec3, snapFrac: number): Corners {
  const found: { p: Box; q: Box; key: string; sign: number }[] = [];
  const pooled = new Map<string, number>();
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const p = boxes[i];
      const q = boxes[j];
      if (p.thin < 0 || q.thin < 0 || p.thin === q.thin) continue;
      const a = q.thin;
      const b = p.thin;
      if (overlap(p, q, 3 - a - b) <= 0) continue;
      const end = meeting(p, a, q);
      const edge = meeting(q, b, p);
      const near = (m: typeof end, axis: number): boolean =>
        Math.min(Math.abs(m.raw - m.inner), Math.abs(m.raw - m.outer)) <= snapFrac * size[axis];
      if (!near(end, a) || !near(edge, b)) continue;
      // Positive: p running past q fits the rough layout better than q running past p.
      const margin =
        sq((end.raw - end.inner) / size[a]) + sq((edge.raw - edge.outer) / size[b]) -
        sq((end.raw - end.outer) / size[a]) - sq((edge.raw - edge.inner) / size[b]);
      const sameRoot = p.root === q.root;
      const key = sameRoot ? pairKey(p, q) : [p.root, q.root].sort().join("|");
      const sign = sameRoot || p.root < q.root ? 1 : -1;
      pooled.set(key, (pooled.get(key) ?? 0) + sign * margin);
      found.push({ p, q, key, sign });
    }
  }
  const corners: Corners = { passes: new Set(), stops: new Set() };
  for (const { p, q, key, sign } of found) {
    const [winner, loser] = sign * (pooled.get(key) ?? 0) > 0 ? [p, q] : [q, p];
    corners.passes.add(pairKey(winner, loser));
    corners.stops.add(pairKey(loser, winner));
  }
  return corners;
}

// Step 5: repeated parallel boards sit evenly between the boards (or box sides) around them.
// Boards at the same height count as one level, so four coplanar dividers land mid-way.
export function spaceEvenly(boxes: Box[], size: Vec3, snapFrac: number): boolean {
  let moved = false;
  for (const group of groupsOf(boxes)) {
    const a = group[0].thin;
    const free = group.filter((b) => !b.fixed).sort((p, q) => rawMid(p, a) - rawMid(q, a));
    if (group.length < 2 || free.length === 0) continue;
    const tol = snapFrac * size[a];
    const thickness = free[0].hi[a] - free[0].lo[a];

    const levels: Box[][] = [];
    for (const b of free) {
      const level = levels[levels.length - 1];
      if (level && rawMid(b, a) - rawMid(level[level.length - 1], a) <= tol) level.push(b);
      else levels.push([b]);
    }

    let lower = 0;
    let upper = size[a];
    const first = rawMid(free[0], a);
    const last = rawMid(free[free.length - 1], a);
    for (const q of boxes) {
      if (q.thin !== a || free.includes(q)) continue;
      if (!free.some((b) => AXES.every((i) => i === a || overlap(b, q, i) > 0))) continue;
      if (mid(q, a) < first) lower = Math.max(lower, q.hi[a]);
      if (mid(q, a) > last) upper = Math.min(upper, q.lo[a]);
    }

    const gap = (upper - lower - levels.length * thickness) / (levels.length + 1);
    const targets = levels.map((_, i) => lower + gap * (i + 1) + thickness * i);
    // Not evenly spaced in the rough layout either → leave this group where the AI put it.
    const fits = levels.every((level, i) =>
      level.every((b) => Math.abs(targets[i] + thickness / 2 - rawMid(b, a)) <= tol),
    );
    if (gap <= 0 || !fits) continue;

    levels.forEach((level, i) => {
      for (const b of level) {
        if (Math.abs(b.lo[a] - targets[i]) > EPS) moved = true;
        b.lo[a] = targets[i];
        b.hi[a] = targets[i] + thickness;
      }
    });
  }
  return moved;
}

// The plane an end face should stop at: the first box side or perpendicular board it would run
// into going outward from the part's centre, provided the rough layout put the face near it.
function wallFor(p: Box, a: number, high: boolean, boxes: Box[], size: Vec3, snapFrac: number, corners: Corners) {
  const tol = snapFrac * size[a];
  const raw = high ? p.rawHi[a] : p.rawLo[a];
  const planes: number[] = [];
  const side = high ? size[a] : 0;
  if (Math.abs(side - raw) <= tol) planes.push(side);
  for (const q of boxes) {
    if (q === p || q.thin !== a || corners.passes.has(pairKey(p, q))) continue;
    if (high ? mid(q, a) <= rawMid(p, a) : mid(q, a) >= rawMid(p, a)) continue;
    const plane = high ? q.lo[a] : q.hi[a];
    if (Math.abs(plane - raw) > tol) continue;
    const inTheWay = corners.stops.has(pairKey(p, q)) || AXES.every((i) => i === a || overlap(p, q, i) > 0);
    if (inTheWay) planes.push(plane);
  }
  if (planes.length === 0) return undefined;
  return high ? Math.min(...planes) : Math.max(...planes);
}

// Steps 3 and 4 for every face that is not a board's thickness: flush to the box, or butted
// against the board it runs into. Faces move on their own, so this also fixes the part's size.
export function snapFaces(boxes: Box[], size: Vec3, snapFrac: number, corners: Corners): boolean {
  let moved = false;
  for (const p of boxes) {
    for (const a of AXES) {
      if (a === p.thin) continue;
      for (const high of [false, true]) {
        const target = wallFor(p, a, high, boxes, size, snapFrac, corners);
        const face = high ? p.hi : p.lo;
        if (target === undefined || Math.abs(face[a] - target) <= EPS) continue;
        face[a] = target;
        moved = true;
      }
      if (p.hi[a] - p.lo[a] <= EPS) {
        p.lo[a] = p.rawLo[a];
        p.hi[a] = p.rawHi[a];
      }
    }
  }
  return moved;
}
