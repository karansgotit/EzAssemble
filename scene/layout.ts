import { validateLayout } from "./layoutChecks";
import { decideCorners, groupsOf, snapFaces, spaceEvenly, type Box } from "./layoutSnap";
import { HARDWARE_KINDS, type AiPart, type PartsLayout, type ScenePart, type Vec3 } from "./types";

// Board thicknesses IKEA actually uses, in cm.
export const THICKNESS_CLASSES_CM = [1.2, 1.6, 1.8, 2.5, 3.8];

// How far a face may sit from a box side or neighbouring board and still be pulled onto it, as a
// fraction of the product size on that axis. The docs say 4%, but ±8% noise on a centre near the
// far side of the box moves a face by up to 8% of that side, so 4% cannot pass the AJI-01 noise
// test. Tune this against the real homeFrac error Karan reports in KAR-07.
export const SNAP_FRAC = 0.1;

// Anything thicker than this is a block (leg, drawer), not a board.
const MAX_BOARD_CM = 4.8;
const MAX_PASSES = 5;
const AXES = [0, 1, 2];

export interface SnapResult {
  ok: boolean;
  parts: ScenePart[];
  errors: string[];
  moves: { id: string; deltaCm: number }[]; // largest distance any face of the part was moved
}

const round = (n: number, digits: number): number => Math.round(n * 10 ** digits) / 10 ** digits;
const isVec3 = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));
const median = (values: number[]): number => {
  const sorted = [...values].sort((x, y) => x - y);
  return (sorted[Math.floor((sorted.length - 1) / 2)] + sorted[Math.ceil((sorted.length - 1) / 2)]) / 2;
};
const nearestClass = (cm: number): number =>
  THICKNESS_CLASSES_CM.reduce((best, c) => (Math.abs(c - cm) < Math.abs(best - cm) ? c : best));

// "Shelf 1", "Shelf 2" and "End panel (top when upright)" → "shelf", "shelf", "end panel".
export function labelRoot(label: string): string {
  return label.toLowerCase().replace(/\([^)]*\)/g, "").replace(/[\s#_-]*\d+\s*$/, "").trim();
}

// Step 1: fractions of the build-frame size → centimetres.
function toBox(part: AiPart, sizeFrac: Vec3, homeFrac: Vec3, size: Vec3): Box {
  const lo = AXES.map((i) => (homeFrac[i] - sizeFrac[i] / 2) * size[i]);
  const hi = AXES.map((i) => (homeFrac[i] + sizeFrac[i] / 2) * size[i]);
  const root = labelRoot(part.label);
  return { id: part.id, part, lo, hi, rawLo: [...lo], rawHi: [...hi], thin: -1, fixed: false, root };
}

// Step 2: a panel's thinnest side becomes a real board thickness. Repeated boards are cut from
// the same stock, so a group shares one class, taken from the median of its rough thicknesses.
function snapThickness(boxes: Box[]): void {
  for (const b of boxes) {
    if (b.part.kind !== "panel") continue;
    const sizes = AXES.map((i) => b.hi[i] - b.lo[i]);
    const thin = sizes.indexOf(Math.min(...sizes));
    if (sizes[thin] <= MAX_BOARD_CM) b.thin = thin;
  }
  for (const group of groupsOf(boxes)) {
    const a = group[0].thin;
    const thickness = nearestClass(median(group.map((b) => b.rawHi[a] - b.rawLo[a])));
    for (const b of group) {
      const centre = (b.lo[a] + b.hi[a]) / 2;
      b.lo[a] = centre - thickness / 2;
      b.hi[a] = centre + thickness / 2;
    }
  }
}

// Step 3 for board thickness: a board lying near a side of the product box sits flush on it.
function flushBoards(boxes: Box[], size: Vec3, snapFrac: number): void {
  for (const b of boxes) {
    if (b.thin < 0) continue;
    const a = b.thin;
    const thickness = b.hi[a] - b.lo[a];
    const toLow = Math.abs(b.lo[a]);
    const toHigh = Math.abs(size[a] - b.hi[a]);
    if (Math.min(toLow, toHigh) > snapFrac * size[a]) continue;
    b.lo[a] = toLow <= toHigh ? 0 : size[a] - thickness;
    b.hi[a] = b.lo[a] + thickness;
    b.fixed = true;
  }
}

function toScenePart(part: AiPart, box?: Box): ScenePart {
  const scenePart: ScenePart = {
    id: part.id,
    label: part.label,
    kind: part.kind,
    count: part.count,
    shape: part.shape,
    features: part.features ?? [],
  };
  if (part.ikeaNumber !== undefined) scenePart.ikeaNumber = part.ikeaNumber;
  if (part.hardwareMm !== undefined) scenePart.hardwareMm = part.hardwareMm;
  if (box) {
    scenePart.sizeCm = AXES.map((i) => round(box.hi[i] - box.lo[i], 4)) as Vec3;
    scenePart.homeCm = AXES.map((i) => round((box.lo[i] + box.hi[i]) / 2, 4)) as Vec3;
  }
  return scenePart;
}

// Rough AI layout (fractions) → exact centimetres with no gaps or overlaps. Never throws:
// anything it cannot place or fix comes back as a sentence in `errors`.
export function snapLayout(layout: PartsLayout, buildSizeCm: Vec3): SnapResult {
  return snapLayoutWith(layout, buildSizeCm, SNAP_FRAC);
}

// Same, with an explicit snap distance, for tuning against real AI output.
export function snapLayoutWith(layout: PartsLayout, buildSizeCm: Vec3, snapFrac: number): SnapResult {
  const errors: string[] = [];
  const parts = Array.isArray(layout?.parts) ? layout.parts : [];
  const sizeOk = isVec3(buildSizeCm) && buildSizeCm.every((n) => n > 0);
  if (!sizeOk) errors.push("The product size must be three positive numbers.");

  const boxes: Box[] = [];
  for (const part of parts) {
    if (HARDWARE_KINDS.includes(part.kind)) continue;
    const { sizeFrac, homeFrac } = part;
    if (!isVec3(sizeFrac) || !isVec3(homeFrac) || sizeFrac.some((n) => n <= 0)) {
      errors.push(`part "${part.id}" needs a sizeFrac and a homeFrac to be placed`);
    } else if (sizeOk) {
      boxes.push(toBox(part, sizeFrac, homeFrac, buildSizeCm));
    }
  }

  snapThickness(boxes);
  flushBoards(boxes, buildSizeCm, snapFrac);
  const corners = decideCorners(boxes, buildSizeCm, snapFrac);
  // Step 4's loop: each pass can only use neighbours as exact as the previous pass left them.
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const spaced = spaceEvenly(boxes, buildSizeCm, snapFrac);
    const snapped = snapFaces(boxes, buildSizeCm, snapFrac, corners);
    if (!spaced && !snapped) break;
  }
  if (sizeOk) errors.push(...validateLayout(boxes, buildSizeCm));

  const boxOf = new Map(boxes.map((b) => [b.part, b]));
  const moves = boxes
    .map((b) => {
      const deltas = AXES.flatMap((i) => [Math.abs(b.lo[i] - b.rawLo[i]), Math.abs(b.hi[i] - b.rawHi[i])]);
      return { id: b.id, deltaCm: round(Math.max(...deltas), 2) };
    })
    .filter((m) => m.deltaCm > 0);

  return { ok: errors.length === 0, parts: parts.map((p) => toScenePart(p, boxOf.get(p))), errors, moves };
}
