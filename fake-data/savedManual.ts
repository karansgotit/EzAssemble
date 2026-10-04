// FAKE DATA, not real AI output: a tiny saved manual (4 pages, 3 steps) that the mock API answers from.
// Replace with fixtures/kallax.gold.json once KAR-02 lands. See fake-data/README.md.
import type { SavedManual } from "@/schema";

export const fakeSavedManual: SavedManual = {
  schemaVersion: 1,
  id: "fake-kallax",
  title: "KALLAX 2×4 shelving unit (fake data)",
  productSizeCm: [77, 147, 39],
  createdAt: "2026-10-03T00:00:00Z",
  pages: [
    { pageType: "cover", steps: [] },
    { pageType: "parts", steps: [] },
    { pageType: "steps", steps: [{ stepNumber: 1, box: [30, 20, 480, 980] }, { stepNumber: 2, box: [500, 20, 960, 980] }] },
    { pageType: "steps", steps: [{ stepNumber: 3, box: [30, 20, 480, 980] }] },
  ],
  layout: {
    buildOrientation: "on-back",
    parts: [
      { id: "L1", label: "Long side panel", kind: "panel", count: 1, shape: "box", sizeFrac: [0.95, 1, 0.05], homeFrac: [0.5, 0.5, 0.025], features: [{ type: "holes", face: "front" }] },
      { id: "E1", label: "End panel", kind: "panel", count: 1, shape: "box", sizeFrac: [0.026, 1, 1], homeFrac: [0.013, 0.5, 0.5], features: [{ type: "holes", face: "right" }] },
      { id: "S1", label: "Shelf 1", kind: "panel", count: 1, shape: "box", sizeFrac: [0.011, 1, 0.9], homeFrac: [0.26, 0.5, 0.5], features: [] },
      { id: "dowel", ikeaNumber: "101339", label: "Wooden dowel", kind: "dowel", count: 22, shape: "cylinder", hardwareMm: { length: 30, diameter: 8 }, features: [] },
      { id: "screw", ikeaNumber: "104321", label: "Long assembly screw", kind: "screw", count: 8, shape: "cylinder", hardwareMm: { length: 50, diameter: 5 }, features: [] },
    ],
  },
  steps: [
    {
      status: "ok",
      crop: "crops/step-01.jpg",
      attempts: 1,
      step: {
        stepNumber: 1,
        kind: "assembly",
        confidence: "high",
        instruction: "Stand the end panel against the long panel and drive in 2 screws.",
        actions: [
          { verb: "place", part: "L1", count: 1 },
          { verb: "attach", part: "E1", count: 1, target: "L1", face: "left" },
          { verb: "screw", part: "screw", count: 2, target: "E1", face: "left", for: "L1" },
        ],
        orientationTrap: { part: "E1", mustFace: "right", wrong: "flipped-horizontal", hint: "Drilled holes face inward", source: "manual" },
      },
    },
    {
      status: "ok",
      crop: "crops/step-02.jpg",
      attempts: 1,
      step: {
        stepNumber: 2,
        kind: "assembly",
        confidence: "high",
        instruction: "Tap 2 dowels into the long panel for the first shelf.",
        actions: [{ verb: "insert", part: "dowel", count: 2, target: "L1", face: "front", for: "S1" }],
      },
    },
    {
      status: "ok",
      crop: "crops/step-03.jpg",
      attempts: 2,
      step: {
        stepNumber: 3,
        kind: "assembly",
        confidence: "medium",
        instruction: "Push the first shelf onto the 2 dowels.",
        actions: [{ verb: "place", part: "S1", count: 1, target: "L1", face: "front" }],
      },
    },
  ],
};
