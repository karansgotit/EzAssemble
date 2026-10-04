import {
  ACTION_GAP, DURATIONS, END_HOLD, HARDWARE_APPROACH_CM, HARDWARE_SCALE, PANEL_APPROACH_CM,
  PANEL_APPROACH_FRAC, SCREW_TURNS, STAGGER, WAITING_OPACITY,
} from "./constants";
import { add, mix, normalAxis, scale, settleOnFloor, slerp, type Bounds, type Quat } from "./geometry";
import { ASSEMBLY_ID, assemblyBounds, type SceneState } from "./resolveScene";
import type { SceneManual, Vec3, Verb } from "./types";

export interface Pose {
  position: Vec3;
  quaternion: Quat;
  spin: number;
  opacity: number;
}

// One piece's movement during a step. `id` is an instance id, or "assembly" for a flip.
export interface Track {
  id: string;
  verb: Verb;
  from: Pose;
  to: Pose;
  start: number;
  duration: number;
  pivot?: Bounds; // flip only: the box the assembly turns about
}

const TAP_START = 0.85; // an inserted piece arrives here, then gets one small knock
const TAP_DEPTH = 0.05;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

// The motion of the last step in `after`, given the scene just before it. Pure: the same two
// states always give the same tracks.
export function buildTracks(
  manual: SceneManual,
  before: SceneState,
  after: SceneState,
  hardwareScale = HARDWARE_SCALE,
): { tracks: Track[]; totalDuration: number } {
  const tracks: Track[] = [];
  const actions = after.stepActions.length > before.stepActions.length ? after.stepActions[after.stepActions.length - 1] : [];
  let cursor = 0;

  for (const { action, ids, normal } of actions) {
    const duration = DURATIONS[action.verb];
    ids.forEach((id, i) => {
      const start = cursor + i * STAGGER;
      if (id === ASSEMBLY_ID) {
        const pose = (s: SceneState): Pose => ({ ...s.assembly, spin: 0, opacity: 1 });
        tracks.push({ id, verb: "flip", from: pose(before), to: pose(after), start, duration, pivot: assemblyBounds(after, manual) });
        return;
      }
      const piece = after.placed.get(id);
      if (!piece) return;
      const to: Pose = { position: piece.position, quaternion: piece.quaternion, spin: piece.spin, opacity: 1 };
      let from: Pose;
      if (action.verb === "lock") {
        from = { ...to, spin: before.placed.get(id)?.spin ?? to.spin - Math.PI / 2 };
      } else if (action.verb === "insert" || action.verb === "screw") {
        const distance = (HARDWARE_APPROACH_CM * hardwareScale) / HARDWARE_SCALE;
        const turns = action.verb === "screw" ? SCREW_TURNS * 2 * Math.PI : 0;
        from = { ...to, position: add(to.position, scale(normal, distance)), spin: to.spin - turns };
      } else {
        const distance = piece.size[normalAxis(normal)] * PANEL_APPROACH_FRAC + PANEL_APPROACH_CM;
        from = { ...to, position: add(to.position, scale(normal, distance)) };
      }
      tracks.push({ id, verb: action.verb, from, to, start, duration });
    });
    cursor += duration + Math.max(0, ids.length - 1) * STAGGER + ACTION_GAP;
  }

  return { tracks, totalDuration: tracks.length > 0 ? cursor - ACTION_GAP + END_HOLD : END_HOLD };
}

// Where every moving piece is at `seconds` into the step.
export function sample(tracks: Track[], seconds: number): Map<string, Pose> {
  const poses = new Map<string, Pose>();
  for (const track of tracks) {
    // A later track for the same piece (a lock after its insert) must not hide the earlier one.
    if (seconds < track.start && poses.has(track.id)) continue;
    const progress = clamp01((seconds - track.start) / track.duration);
    const tapping = track.verb === "insert" && progress > TAP_START && progress < 1;
    const eased = easeInOutCubic(track.verb === "insert" ? clamp01(progress / TAP_START) : progress);

    let position = mix(track.from.position, track.to.position, eased);
    const quaternion = slerp(track.from.quaternion, track.to.quaternion, eased);
    if (tapping) {
      const knock = Math.sin(((progress - TAP_START) / (1 - TAP_START)) * Math.PI) * TAP_DEPTH;
      position = mix(track.to.position, track.from.position, knock);
    }
    if (track.pivot) {
      // Re-seat the turning assembly every frame so no corner dips below the floor.
      position = settleOnFloor(track.pivot, quaternion);
    }
    poses.set(track.id, {
      position,
      quaternion,
      spin: track.from.spin + (track.to.spin - track.from.spin) * eased,
      opacity: seconds < track.start ? WAITING_OPACITY : 1,
    });
  }
  return poses;
}
