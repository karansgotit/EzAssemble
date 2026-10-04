import { describe, expect, it } from "vitest";
import { initialPlayback, playbackReducer, type PlaybackState } from "@/player/playback";

const TOTAL = 19;
const midStep: PlaybackState = { ...initialPlayback, stepIndex: 4, playKey: 7, playing: false, progress: 0.6, scrubT: 0.6 };

describe("playbackReducer", () => {
  it("starts on the first step, playing at normal speed", () => {
    expect(initialPlayback).toMatchObject({ stepIndex: 0, playing: true, speed: 1, progress: 0, scrubT: null });
  });

  it("goTo opens the step and plays it from the start", () => {
    const next = playbackReducer(midStep, { type: "goTo", index: 5, total: TOTAL });
    expect(next).toMatchObject({ stepIndex: 5, playKey: 8, playing: true, progress: 0, scrubT: null });
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

  it("toggle pauses and resumes without restarting", () => {
    const playing = { ...initialPlayback, progress: 0.3 };
    const paused = playbackReducer(playing, { type: "toggle" });
    expect(paused).toMatchObject({ playing: false, playKey: 0, progress: 0.3 });
    expect(playbackReducer(paused, { type: "toggle" })).toMatchObject({ playing: true, playKey: 0, progress: 0.3 });
  });

  it("toggle releases a held scrub position", () => {
    expect(playbackReducer(midStep, { type: "toggle" })).toMatchObject({ playing: true, scrubT: null, progress: 0.6 });
  });

  it("toggle replays a finished animation", () => {
    const finished = playbackReducer({ ...initialPlayback, progress: 0.9 }, { type: "done" });
    expect(finished).toMatchObject({ playing: false, progress: 1 });
    expect(playbackReducer(finished, { type: "toggle" })).toMatchObject({ playing: true, progress: 0, playKey: 1 });
  });

  it("replay restarts the same step", () => {
    expect(playbackReducer(midStep, { type: "replay" })).toMatchObject({
      stepIndex: 4,
      playKey: 8,
      playing: true,
      progress: 0,
      scrubT: null,
    });
  });

  it("scrub holds a position and pauses", () => {
    expect(playbackReducer(initialPlayback, { type: "scrub", t: 0.25 })).toMatchObject({
      playing: false,
      progress: 0.25,
      scrubT: 0.25,
    });
  });

  it("scrub and progress stay within 0..1", () => {
    expect(playbackReducer(initialPlayback, { type: "scrub", t: 4 }).scrubT).toBe(1);
    expect(playbackReducer(initialPlayback, { type: "scrub", t: -1 }).scrubT).toBe(0);
    expect(playbackReducer(initialPlayback, { type: "progress", t: 1.2 }).progress).toBe(1);
    expect(playbackReducer(initialPlayback, { type: "progress", t: NaN }).progress).toBe(0);
  });

  it("progress updates only the progress", () => {
    expect(playbackReducer(initialPlayback, { type: "progress", t: 0.5 })).toEqual({ ...initialPlayback, progress: 0.5 });
  });
});
