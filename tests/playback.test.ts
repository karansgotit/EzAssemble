import { describe, expect, it } from "vitest";
import { initialPlayback, playbackReducer, type PlaybackState } from "@/player/playback";

const TOTAL = 19;
const midStep: PlaybackState = { stepIndex: 4, playKey: 7, speed: 1 };

describe("playbackReducer", () => {
  it("starts on the first step at normal speed", () => {
    expect(initialPlayback).toEqual({ stepIndex: 0, playKey: 0, speed: 1 });
  });

  it("goTo opens the step and plays it from the start", () => {
    expect(playbackReducer(midStep, { type: "goTo", index: 5, total: TOTAL })).toEqual({ stepIndex: 5, playKey: 8, speed: 1 });
  });

  it("goTo clamps to the first and last step", () => {
    expect(playbackReducer(midStep, { type: "goTo", index: -3, total: TOTAL }).stepIndex).toBe(0);
    expect(playbackReducer(midStep, { type: "goTo", index: 99, total: TOTAL }).stepIndex).toBe(TOTAL - 1);
  });

  it("goTo does nothing when the step would not change", () => {
    expect(playbackReducer(initialPlayback, { type: "goTo", index: -1, total: TOTAL })).toBe(initialPlayback);
    const last = { ...midStep, stepIndex: TOTAL - 1 };
    expect(playbackReducer(last, { type: "goTo", index: TOTAL, total: TOTAL })).toBe(last);
  });

  it("goTo keeps the chosen speed", () => {
    const slow = playbackReducer(midStep, { type: "speed", speed: 0.5 });
    expect(playbackReducer(slow, { type: "goTo", index: 6, total: TOTAL }).speed).toBe(0.5);
  });

  it("replay restarts the same step", () => {
    expect(playbackReducer(midStep, { type: "replay" })).toEqual({ stepIndex: 4, playKey: 8, speed: 1 });
  });

  it("speed changes only the speed, without restarting", () => {
    expect(playbackReducer(midStep, { type: "speed", speed: 2 })).toEqual({ stepIndex: 4, playKey: 7, speed: 2 });
  });
});
