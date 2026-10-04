// FAKE DATA, not real AI output: a small manual with one step of every kind the player must handle.
// Stands in for buildSceneManual(gold KALLAX) until KAR-01 / KAR-02 / AJI-03 land. See fake-data/README.md.
import type { SceneManual } from "@/player/tempContracts";

const CROPS = "/fake-data/crops";

export const fakeManual: SceneManual = {
  id: "fake-kallax",
  title: "KALLAX 2×4 shelving unit (fake data)",
  buildSizeCm: [147, 39, 77],
  buildOrientation: "on-back",
  parts: [
    { id: "L1", label: "Long side panel", kind: "panel", count: 1, shape: "box", features: [{ type: "holes", face: "front" }] },
    { id: "E1", label: "End panel", kind: "panel", count: 1, shape: "box", features: [{ type: "holes", face: "right" }] },
    { id: "S1", label: "Shelf 1", kind: "panel", count: 1, shape: "box", features: [{ type: "holes", face: "left" }] },
    { id: "dowel", ikeaNumber: "101339", label: "Wooden dowel", kind: "dowel", count: 22, shape: "cylinder", hardwareMm: { length: 30, diameter: 8 }, features: [] },
    { id: "screw", ikeaNumber: "104321", label: "Screw", kind: "screw", count: 8, shape: "cylinder", hardwareMm: { length: 50, diameter: 5 }, features: [] },
    { id: "drawer", label: "Drawer", kind: "other", count: 2, shape: "box", features: [] },
  ],
  steps: [
    {
      stepNumber: 1,
      kind: "assembly",
      confidence: "high",
      crop: `${CROPS}/step-01.png`,
      instruction: "Stand the end panel against the long panel and drive in 2 screws.",
      actions: [
        { verb: "place", part: "L1", count: 1 },
        { verb: "attach", part: "E1", count: 1, target: "L1", face: "left" },
        { verb: "screw", part: "screw", count: 2, target: "E1", face: "left", for: "L1" },
      ],
      trap: { part: "E1", mustFace: "right", wrong: "flipped-horizontal", hint: "Drilled holes face inward", source: "manual", autoplay: true },
    },
    {
      stepNumber: 3,
      kind: "assembly",
      confidence: "high",
      crop: `${CROPS}/step-03.png`,
      instruction: "Tap 2 dowels into the long panel and push the first shelf onto them.",
      actions: [
        { verb: "insert", part: "dowel", count: 2, target: "L1", face: "front", for: "S1" },
        { verb: "place", part: "S1", count: 1, target: "L1", face: "front" },
      ],
      trap: { part: "S1", mustFace: "left", wrong: "flipped-horizontal", hint: "Holes face the next divider", source: "geometry", autoplay: false },
    },
    {
      stepNumber: 4,
      kind: "assembly",
      confidence: "low",
      crop: `${CROPS}/step-03.png`,
      instruction: "Tap 2 more dowels into the shelf you just placed.",
      actions: [{ verb: "insert", part: "dowel", count: 2, target: "S1", face: "top" }],
    },
    {
      stepNumber: 5,
      kind: "subassembly",
      confidence: "high",
      instruction: "The 2 drawers are assembled separately (manual steps 5–9). Follow the manual for those, then continue here.",
      actions: [],
    },
    {
      stepNumber: 10,
      kind: "failed",
      confidence: "low",
      crop: `${CROPS}/step-03.png`,
      instruction: "Follow the original diagram for this step.",
      actions: [],
    },
    {
      stepNumber: 11,
      kind: "assembly",
      confidence: "medium",
      crop: `${CROPS}/missing.png`,
      instruction: "Stand the shelving unit upright. (This step's diagram is missing on purpose.)",
      actions: [{ verb: "flip", part: "assembly", count: 1, flipMode: "stand-up" }],
    },
    {
      stepNumber: 16,
      kind: "info",
      confidence: "high",
      crop: `${CROPS}/step-16.png`,
      instruction: "Fix the unit to the wall so it can't tip over.",
      actions: [],
    },
  ],
};
