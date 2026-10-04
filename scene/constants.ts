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

// Line weights, in screen pixels. The part being added is drawn heavier, like the bold
// outline a manual gives the piece in your hand.
export const EDGE_WIDTH = { current: 2.4, previous: 1.1, hardware: 1.3, ghost: 2.2 };
export const GUIDE_WIDTH = 2.4;
export const GUIDE_DASH_CM: [number, number] = [2.2, 1.4]; // dash, gap
export const GHOST_DASH_CM: [number, number] = [2.4, 1.6]; // the wrong pose is drawn dashed
export const SHADOW_OPACITY = 0.3;

// Each scene colour: the design token it is read from (docs/design/tokens.css) and the
// designed value, used when the page does not define that token.
const SCENE_TOKENS = {
  background: ["--scene-bg", "#FAFAF8"],
  floor: ["--scene-floor", "#ECEDE8"],
  current: ["--scene-current", "#C9D6FF"],
  previous: ["--scene-part", "#FFFFFF"],
  edge: ["--scene-part-edge", "#8B9096"],
  edgeStrong: ["--scene-current-edge", "#14161A"],
  guide: ["--scene-guide", "#2447E0"],
  wood: ["--scene-wood", "#D8B98A"],
  steel: ["--scene-steel", "#B4BAC2"],
  wrong: ["--scene-wrong", "#C8321E"],
  right: ["--scene-right", "#1B7A48"],
  hole: ["--scene-hole", "#2A2D33"],
} as const;

export type SceneColors = Record<keyof typeof SCENE_TOKENS, string>;
const colorNames = Object.keys(SCENE_TOKENS) as (keyof typeof SCENE_TOKENS)[];

export const COLORS = Object.fromEntries(colorNames.map((name) => [name, SCENE_TOKENS[name][1]])) as SceneColors;

const LOOKS_LIKE_A_COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|(rgb|hsl)a?\([^)]+\))$/i;

// The scene colours as the page defines them. `getVariable` returns a CSS variable's value
// ("" when unset); anything missing or not a colour falls back to the designed value.
export function readSceneColors(getVariable: (name: string) => string): SceneColors {
  const read = (name: keyof typeof SCENE_TOKENS): string => {
    const [token, fallback] = SCENE_TOKENS[name];
    let value = "";
    try {
      value = String(getVariable(token) ?? "").trim();
    } catch {
      value = "";
    }
    return LOOKS_LIKE_A_COLOR.test(value) ? value : fallback;
  };
  return Object.fromEntries(colorNames.map((name) => [name, read(name)])) as SceneColors;
}
