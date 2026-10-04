import type { Verb } from "./types";

// Real dowels and screws are a few mm wide next to 140 cm panels; drawn larger so they read.
export const HARDWARE_SCALE = 2.5;

// Seconds at speed 1.
export const DURATIONS: Record<Verb, number> = {
  insert: 0.8,
  screw: 1.4,
  lock: 0.5,
  attach: 1.2,
  place: 1.2,
  flip: 2,
};
export const ACTION_GAP = 0.25; // pause between one action and the next
export const STAGGER = 0.15; // delay between pieces of the same action
export const END_HOLD = 0.4; // stillness after the last piece lands

export const SCREW_TURNS = 3;
export const WAITING_OPACITY = 0.4; // a piece whose turn has not come yet
export const HARDWARE_APPROACH_CM = 6; // how far out hardware starts, at HARDWARE_SCALE 2.5
export const PANEL_APPROACH_CM = 10; // plus 35% of the panel's own depth
export const PANEL_APPROACH_FRAC = 0.35;

// The wrong-vs-right ghost, shown before a step's own motion.
export const TRAP_WRONG_SECONDS = 1.2; // held in the wrong pose
export const TRAP_TURN_SECONDS = 1; // turning to the right pose
export const TRAP_FADE_SECONDS = 0.4; // fading away
export const TRAP_SECONDS = TRAP_WRONG_SECONDS + TRAP_TURN_SECONDS + TRAP_FADE_SECONDS;
export const GHOST_OPACITY = 0.45;

// Placeholders until the Claude Design tokens land (AJI-11).
export const COLORS = {
  background: "#fbfaf7",
  floor: "#e9e7df",
  current: "#ffd23f",
  previous: "#ffffff",
  edge: "#9b9b9b",
  edgeStrong: "#111111",
  guide: "#0058a3",
  wood: "#d9b98a",
  steel: "#b8bec6",
  wrong: "#e5484d",
  right: "#30a46c",
  hole: "#333333",
};
