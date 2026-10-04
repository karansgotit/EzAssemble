import { describe, expect, it } from "vitest";
import { add, cornersOf, rotate } from "@/scene/geometry";
import { resolveScene } from "@/scene/resolveScene";
import { buildTracks, easeInOutCubic, easeInOutSine, glideIn, sample } from "@/scene/tracks";
import { loadKallaxScene } from "./helpers/kallaxScene";

const manual = loadKallaxScene();
const tracksOf = (stepNumber: number) =>
  buildTracks(manual, resolveScene(manual, stepNumber - 2), resolveScene(manual, stepNumber - 1));

describe("buildTracks", () => {
  it("staggers pieces by 0.15 s and leaves 0.25 s between actions", () => {
    const { tracks, totalDuration } = tracksOf(3); // 2 dowels, then shelf 1
    expect(tracks.map((t) => t.id)).toEqual(["dowel#3", "dowel#4", "S1#1"]);
    expect(tracks[1].start - tracks[0].start).toBeCloseTo(0.15);
    expect(tracks[2].start - (tracks[1].start + tracks[1].duration)).toBeCloseTo(0.25);
    expect(totalDuration).toBeCloseTo(tracks[2].start + tracks[2].duration + 0.4);
  });

  it("brings hardware in along the face normal and panels in from the target face", () => {
    const { tracks } = tracksOf(3);
    expect(tracks[0].from.position[2] - tracks[0].to.position[2]).toBeCloseTo(6);
    expect(tracks[2].from.position[2] - tracks[2].to.position[2]).toBeCloseTo(69.4 * 0.35 + 10);
    const divider = tracksOf(5).tracks[0]; // D2 slides onto S1's right face
    expect(divider.from.position[0]).toBeGreaterThan(divider.to.position[0]);
    expect(divider.from.position[1]).toBe(divider.to.position[1]);
  });

  it("gives info steps no tracks, only the closing hold", () => {
    expect(tracksOf(16)).toEqual({ tracks: [], totalDuration: 0.4 });
  });
});

describe("sample", () => {
  it("returns from at 0, to at the end, and something between in the middle", () => {
    const { tracks, totalDuration } = tracksOf(5);
    const [track] = tracks;
    const xAt = (t: number) => sample(tracks, t).get(track.id)?.position[0] ?? NaN;
    expect(xAt(0)).toBeCloseTo(track.from.position[0]);
    expect(xAt(totalDuration)).toBeCloseTo(track.to.position[0]);
    // Half-way through its time a panel is between the two, and already most of the way there.
    const halfWay = (track.from.position[0] + track.to.position[0]) / 2;
    expect(xAt(track.duration / 2)).toBeLessThan(halfWay);
    expect(xAt(track.duration / 2)).toBeGreaterThan(track.to.position[0]);
  });

  it("turns a screw three full turns on its way in", () => {
    const { tracks, totalDuration } = tracksOf(1);
    expect(tracks[0].verb).toBe("screw");
    const spinAt = (t: number) => sample(tracks, t).get(tracks[0].id)?.spin ?? NaN;
    expect(spinAt(totalDuration) - spinAt(0)).toBeCloseTo(3 * 2 * Math.PI);
  });

  it("shows pieces waiting for their turn faded, then solid", () => {
    const { tracks, totalDuration } = tracksOf(3);
    expect(sample(tracks, 0).get("S1#1")?.opacity).toBe(0.4);
    expect(sample(tracks, totalDuration).get("S1#1")?.opacity).toBe(1);
  });

  it("brings a piece up to solid smoothly as it sets off, with no jump", () => {
    const { tracks } = tracksOf(5);
    const [track] = tracks;
    const opacityAt = (progress: number) => sample(tracks, track.start + track.duration * progress).get(track.id)?.opacity ?? NaN;
    expect(opacityAt(0)).toBeCloseTo(0.4);
    expect(opacityAt(0.125)).toBeCloseTo(0.7);
    expect(opacityAt(0.25)).toBeCloseTo(1);
    expect(opacityAt(0.6)).toBe(1);
  });

  it("never moves a piece backwards on its way in, and lands it without a jolt", () => {
    for (const stepNumber of [1, 3, 5, 13]) {
      const { tracks } = tracksOf(stepNumber);
      for (const track of tracks.filter((t) => t.verb !== "insert")) {
        const axis = track.from.position.findIndex((v, i) => v !== track.to.position[i]);
        const travelled = (progress: number) => {
          const p = sample(tracks, track.start + track.duration * progress).get(track.id)?.position[axis] ?? NaN;
          return (p - track.from.position[axis]) / (track.to.position[axis] - track.from.position[axis]);
        };
        let last = 0;
        for (let i = 1; i <= 50; i++) {
          const now = travelled(i / 50);
          expect(now).toBeGreaterThanOrEqual(last - 1e-9);
          last = now;
        }
        expect(1 - travelled(0.98)).toBeLessThan(0.01); // creeping, not arriving at speed
      }
    }
  });

  it("knocks an inserted dowel once and leaves it exactly home", () => {
    const { tracks } = tracksOf(4);
    const [track] = tracks;
    const xAt = (progress: number) =>
      sample(tracks, track.start + track.duration * progress).get(track.id)?.position[0] ?? NaN;
    expect(xAt(0.925)).toBeGreaterThan(track.to.position[0]); // backed out a little
    expect(xAt(1)).toBeCloseTo(track.to.position[0]);
  });

  it("keeps the assembly on the floor all the way through the stand-up", () => {
    const { tracks } = tracksOf(15);
    expect(tracks).toHaveLength(1);
    for (const t of [0, 0.5, 1, 1.5, 2]) {
      const pose = sample(tracks, t).get("assembly");
      if (!pose) throw new Error("no assembly pose");
      const corners = cornersOf({ min: [0, 0, 0], max: [147, 39, 77] });
      const ys = corners.map((c) => add(rotate(c, pose.quaternion), pose.position)[1]);
      expect(Math.min(...ys)).toBeCloseTo(0);
    }
  });

  it("is the same for a given time whatever was sampled before", () => {
    const { tracks } = tracksOf(12);
    const first = sample(tracks, 1);
    sample(tracks, 4);
    expect(sample(tracks, 1)).toEqual(first);
  });

  it("eases from 0 to 1 through the half-way point", () => {
    expect([easeInOutCubic(0), easeInOutCubic(0.5), easeInOutCubic(1)]).toEqual([0, 0.5, 1]);
    expect([easeInOutSine(0), easeInOutSine(1)]).toEqual([0, 1]);
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5);
  });

  it("glides in: a gentle start, most of the way by half time, a slow finish", () => {
    expect([glideIn(0), glideIn(1)]).toEqual([0, 1]);
    expect(glideIn(0.5)).toBeCloseTo(0.75);
    expect(glideIn(0.02)).toBeLessThan(0.005); // barely moving at first
    expect(1 - glideIn(0.9)).toBeLessThan(0.002); // nearly still at the end
  });
});
