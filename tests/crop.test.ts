import { describe, expect, it } from "vitest";
import { boxToPixelRect, fitLongSide } from "@/client/crop";

// A portrait A4 page rasterized at long side 1600.
const W = 1131;
const H = 1600;

describe("boxToPixelRect", () => {
  it("scales a 0–1000 box to pixels when there is no padding", () => {
    expect(boxToPixelRect([250, 100, 750, 900], 1000, 2000, 0)).toEqual({ x: 100, y: 500, width: 800, height: 1000 });
  });

  it("reads the box as [ymin, xmin, ymax, xmax]", () => {
    const rect = boxToPixelRect([0, 0, 100, 1000], 1000, 1000, 0);
    expect(rect).toEqual({ x: 0, y: 0, width: 1000, height: 100 });
  });

  it("pads every side by 2% of the page by default", () => {
    const rect = boxToPixelRect([370, 200, 725, 800], 1000, 1000);
    expect(rect).toEqual({ x: 180, y: 350, width: 640, height: 395 });
  });

  it("clamps the padded rect to the page", () => {
    const rect = boxToPixelRect([35, 20, 340, 980], W, H);
    expect(rect.x).toBe(0);
    expect(rect.x + rect.width).toBe(W);
    expect(rect.y).toBe(24); // (35 - 20) / 1000 × 1600
    expect(rect.y + rect.height).toBe(576); // (340 + 20) / 1000 × 1600
  });

  it("always contains the unpadded box", () => {
    const box: [number, number, number, number] = [333, 111, 666, 777];
    const tight = boxToPixelRect(box, W, H, 0);
    const padded = boxToPixelRect(box, W, H);
    expect(padded.x).toBeLessThan(tight.x);
    expect(padded.y).toBeLessThan(tight.y);
    expect(padded.x + padded.width).toBeGreaterThan(tight.x + tight.width);
    expect(padded.y + padded.height).toBeGreaterThan(tight.y + tight.height);
  });

  it("includes the full step-13 overview when its predicted edge is slightly too tight", () => {
    const rect = boxToPixelRect([501, 68, 924, 856], 1132, 1600);
    // The overview starts around y=799 on the source page, above the tight box.
    expect(rect.y).toBeLessThan(799);
    expect(rect.y + rect.height).toBeGreaterThan(1468);
  });

  it("reorders a reversed box", () => {
    expect(boxToPixelRect([750, 900, 250, 100], 1000, 2000, 0)).toEqual(boxToPixelRect([250, 100, 750, 900], 1000, 2000, 0));
  });

  it("clamps values outside 0–1000", () => {
    expect(boxToPixelRect([-50, -10, 1200, 1500], W, H, 0)).toEqual({ x: 0, y: 0, width: W, height: H });
  });

  it("gives at least 1 px inside the page for a degenerate box", () => {
    for (const box of [[500, 500, 500, 500], [1000, 1000, 1000, 1000], [0, 0, 0, 0]] as const) {
      const rect = boxToPixelRect([...box], W, H, 0);
      expect(rect.width).toBeGreaterThanOrEqual(1);
      expect(rect.height).toBeGreaterThanOrEqual(1);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(W);
      expect(rect.y + rect.height).toBeLessThanOrEqual(H);
    }
  });

  it("falls back to the whole page for a box with non-numbers", () => {
    expect(boxToPixelRect([NaN, 0, 500, 500], W, H)).toEqual({ x: 0, y: 0, width: W, height: H });
    expect(boxToPixelRect([0, 0, Infinity, 500], W, H)).toEqual({ x: 0, y: 0, width: W, height: H });
  });

  it("treats a negative padding as none", () => {
    expect(boxToPixelRect([250, 100, 750, 900], 1000, 2000, -0.5)).toEqual({ x: 100, y: 500, width: 800, height: 1000 });
  });

  it("returns whole pixels", () => {
    const rect = boxToPixelRect([123, 457, 789, 901], W, H);
    for (const value of Object.values(rect)) expect(Number.isInteger(value)).toBe(true);
  });
});

describe("fitLongSide", () => {
  it("shrinks so the long side matches, keeping the shape", () => {
    expect(fitLongSide(1600, 800, 512)).toEqual({ width: 512, height: 256 });
    expect(fitLongSide(800, 1600, 512)).toEqual({ width: 256, height: 512 });
  });

  it("never enlarges", () => {
    expect(fitLongSide(300, 200, 512)).toEqual({ width: 300, height: 200 });
  });

  it("leaves the size alone when no limit is given", () => {
    expect(fitLongSide(1600, 800)).toEqual({ width: 1600, height: 800 });
    expect(fitLongSide(1600, 800, 0)).toEqual({ width: 1600, height: 800 });
  });

  it("keeps a very thin image at least 1 px wide", () => {
    expect(fitLongSide(1, 4000, 512)).toEqual({ width: 1, height: 512 });
  });
});
