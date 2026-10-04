import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { COLORS, readSceneColors } from "@/scene/constants";
import { boxEdges } from "@/scene/geometry";

const tokensCss = readFileSync(fileURLToPath(new URL("../docs/design/tokens.css", import.meta.url)), "utf8");
// The --scene-* variables as docs/design/tokens.css declares them.
const designed = new Map([...tokensCss.matchAll(/(--scene-[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const fromPage = (variables: Record<string, string>) => readSceneColors((name) => variables[name] ?? "");

describe("readSceneColors", () => {
  it("falls back to the designed value for every colour the page does not define", () => {
    expect(fromPage({})).toEqual(COLORS);
  });

  it("has the same defaults as docs/design/tokens.css, so 3D and UI match before SMI-11 too", () => {
    expect(designed.size).toBeGreaterThanOrEqual(12);
    expect(readSceneColors((name) => designed.get(name) ?? "")).toEqual(COLORS);
  });

  it("takes a colour from the page when the token is set", () => {
    const colors = fromPage({ "--scene-current": " #ff8800 ", "--scene-guide": "rgb(10, 20, 30)" });
    expect(colors.current).toBe("#ff8800");
    expect(colors.guide).toBe("rgb(10, 20, 30)");
    expect(colors.floor).toBe(COLORS.floor);
  });

  it("ignores values that are not colours, and a page that cannot be read", () => {
    expect(fromPage({ "--scene-current": "12px", "--scene-wrong": "var(--nope)" })).toEqual(COLORS);
    expect(readSceneColors(() => { throw new Error("no document"); })).toEqual(COLORS);
  });

  it("keeps wrong and right apart, and the current part apart from built parts", () => {
    expect(COLORS.wrong).not.toBe(COLORS.right);
    expect(COLORS.current).not.toBe(COLORS.previous);
  });
});

describe("boxEdges", () => {
  it("gives the 12 edges of a box as 24 end points on its corners", () => {
    const points = boxEdges([4, 6, 10]);
    expect(points).toHaveLength(24);
    for (const [x, y, z] of points) expect([Math.abs(x), Math.abs(y), Math.abs(z)]).toEqual([2, 3, 5]);
    const lengths = [];
    for (let i = 0; i < points.length; i += 2) lengths.push(Math.hypot(...points[i].map((v, k) => v - points[i + 1][k])));
    expect(lengths.sort((a, b) => a - b)).toEqual([4, 4, 4, 4, 6, 6, 6, 6, 10, 10, 10, 10]);
  });
});
