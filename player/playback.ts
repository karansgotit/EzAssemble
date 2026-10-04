// Pure player state: which step is open and how its animation is playing.
// The fields map one-to-one onto <AssemblyScene> props (CONTRACTS §7).

export type Speed = 0.5 | 1 | 2;
export const SPEEDS: readonly Speed[] = [0.5, 1, 2];

export type PlaybackState = {
  stepIndex: number; // 0-based
  playKey: number; // changes → the scene restarts the step's animation
  playing: boolean;
  speed: Speed;
  progress: number; // 0..1, reported by the scene or set by the scrubber
  scrubT: number | null; // 0..1 while the user holds a position; null = play normally
};

export type PlaybackAction =
  | { type: "goTo"; index: number; total: number }
  | { type: "toggle" }
  | { type: "replay" }
  | { type: "scrub"; t: number }
  | { type: "speed"; speed: Speed }
  | { type: "progress"; t: number }
  | { type: "done" };

export const initialPlayback: PlaybackState = {
  stepIndex: 0,
  playKey: 0,
  playing: true,
  speed: 1,
  progress: 0,
  scrubT: null,
};

function clamp01(t: number): number {
  return Number.isFinite(t) ? Math.min(Math.max(t, 0), 1) : 0;
}

function restart(state: PlaybackState): PlaybackState {
  return { ...state, playKey: state.playKey + 1, playing: true, progress: 0, scrubT: null };
}

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "goTo": {
      const last = Math.max(action.total - 1, 0);
      const index = Math.min(Math.max(Math.trunc(action.index), 0), last);
      // Pressing "previous" on the first step (or "next" on the last) must not restart it.
      if (index === state.stepIndex) return state;
      return restart({ ...state, stepIndex: index });
    }
    case "toggle":
      if (state.progress >= 1) return restart(state);
      return { ...state, playing: !state.playing, scrubT: null };
    case "replay":
      return restart(state);
    case "scrub": {
      const t = clamp01(action.t);
      return { ...state, playing: false, progress: t, scrubT: t };
    }
    case "speed":
      return { ...state, speed: action.speed };
    case "progress":
      return { ...state, progress: clamp01(action.t) };
    case "done":
      return { ...state, playing: false, progress: 1 };
  }
}
