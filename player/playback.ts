// Pure player state: which step is open, and how its animation plays.

export type Speed = 0.5 | 1 | 2;
export const SPEEDS: readonly Speed[] = [0.5, 1, 2];

export type PlaybackState = {
  stepIndex: number; // 0-based
  playKey: number; // changes → the scene restarts the step's animation
  speed: Speed;
};

export type PlaybackAction =
  | { type: "goTo"; index: number; total: number }
  | { type: "replay" }
  | { type: "speed"; speed: Speed };

export const initialPlayback: PlaybackState = { stepIndex: 0, playKey: 0, speed: 1 };

export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  switch (action.type) {
    case "goTo": {
      const last = Math.max(action.total - 1, 0);
      const index = Math.min(Math.max(Math.trunc(action.index), 0), last);
      // Pressing "previous" on the first step (or "next" on the last) must not restart it.
      if (index === state.stepIndex) return state;
      return { ...state, stepIndex: index, playKey: state.playKey + 1 };
    }
    case "replay":
      return { ...state, playKey: state.playKey + 1 };
    case "speed":
      return { ...state, speed: action.speed };
  }
}
