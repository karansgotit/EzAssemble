import { describe, expect, it } from "vitest";
import { TRAP_SECONDS } from "@/scene/constants";
import { FACE_NORMALS, NO_ROTATION, rotate, sameRotation } from "@/scene/geometry";
import { featureMarks, ghostAt, ghostLabel, ghostShake, wrongRotation } from "@/scene/ghostFrames";
import type { Face, SceneTrap, Vec3 } from "@/scene/types";

const FACES = Object.keys(FACE_NORMALS) as Face[];
const trap = (over: Partial<SceneTrap> = {}): SceneTrap => ({
  part: "S1", mustFace: "right", wrong: "flipped-horizontal", hint: "Drilled holes face the divider piece", source: "geometry", autoplay: true, ...over,
});
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe("wrongRotation", () => {
  it.each(["flipped-horizontal", "flipped-vertical"] as const)("%s carries the holes to the opposite face, whichever face they are on", (wrong) => {
    for (const face of FACES) {
      const turned = rotate(FACE_NORMALS[face], wrongRotation(wrong, face));
      expect(dot(turned, FACE_NORMALS[face]), `${wrong} / ${face}`).toBeCloseTo(-1);
    }
  });

  it("rotated-90 carries the holes to a neighbouring face", () => {
    for (const face of FACES) {
      const turned = rotate(FACE_NORMALS[face], wrongRotation("rotated-90", face));
      expect(dot(turned, FACE_NORMALS[face]), face).toBeCloseTo(0);
    }
  });

  it("turns side holes about the vertical and top holes about a horizontal axis", () => {
    expect(rotate([0, 1, 0], wrongRotation("flipped-horizontal", "front"))[1]).toBeCloseTo(1); // y stays up
    expect(rotate([1, 0, 0], wrongRotation("flipped-vertical", "top"))[0]).toBeCloseTo(1); // x stays put
  });
});

describe("ghostAt", () => {
  it("holds the wrong pose, red, for the first 1.2 s", () => {
    const wrong = wrongRotation("flipped-horizontal", "right");
    for (const seconds of [0, 0.3, 0.6, 0.9, 1.19]) {
      const frame = ghostAt(trap(), seconds);
      expect(frame?.rightness).toBe(0);
      expect(frame?.label).toBe("✗ Possible mistake");
      // Never more than the small shake away from the wrong pose: the holes stay on the wrong side.
      const holes = rotate([1, 0, 0], frame?.quaternion ?? [0, 0, 0, 1]);
      expect(dot(holes, rotate([1, 0, 0], wrong))).toBeGreaterThan(Math.cos((3 * Math.PI) / 180));
    }
    expect(sameRotation(ghostAt(trap(), 0)?.quaternion ?? [0, 0, 0, 1], wrong)).toBe(true);
  });

  it("fades in over the first quarter second instead of popping up", () => {
    expect(ghostAt(trap(), 0)?.opacity).toBe(0);
    expect(ghostAt(trap(), 0.125)?.opacity).toBeCloseTo(0.225);
    expect(ghostAt(trap(), 0.25)?.opacity).toBeCloseTo(0.45);
    expect(ghostAt(trap(), 0.6)?.opacity).toBeCloseTo(0.45);
  });

  it("shakes its head a little while wrong, and is still when it starts to turn", () => {
    expect(ghostShake(0)).toBe(0);
    expect(ghostShake(1.2)).toBe(0);
    expect(ghostShake(2)).toBe(0);
    const peak = Math.max(...Array.from({ length: 121 }, (_, i) => Math.abs(ghostShake(i / 100))));
    expect(peak).toBeGreaterThan((1.5 * Math.PI) / 180);
    expect(peak).toBeLessThanOrEqual((2.5 * Math.PI) / 180);
    expect(ghostShake(0.4) * ghostShake(0.8)).toBeLessThan(0); // one way, then the other
  });

  it("turns to the right pose and goes green between 1.2 s and 2.2 s", () => {
    const half = ghostAt(trap(), 1.7);
    expect(half?.rightness).toBeCloseTo(0.5);
    expect(half && sameRotation(half.quaternion, NO_ROTATION)).toBe(false);
    expect(half?.label).toBe("✓ Drilled holes face the divider piece");
    const done = ghostAt(trap(), 2.2);
    expect(done?.rightness).toBeCloseTo(1);
    expect(done && sameRotation(done.quaternion, NO_ROTATION)).toBe(true);
    expect(done?.opacity).toBeCloseTo(0.45);
  });

  it("fades out by 2.6 s and is then gone", () => {
    expect(ghostAt(trap(), 2.4)?.opacity).toBeCloseTo(0.225);
    expect(TRAP_SECONDS).toBeCloseTo(2.6);
    expect(ghostAt(trap(), TRAP_SECONDS)).toBeUndefined();
    expect(ghostAt(trap(), 10)).toBeUndefined();
  });
});

describe("ghostLabel", () => {
  it("says where the warning comes from, and never calls it a common mistake", () => {
    expect(ghostLabel(trap({ source: "manual" }), false)).toBe("✗ From the manual");
    expect(ghostLabel(trap({ source: "geometry" }), false)).toBe("✗ Possible mistake");
    for (const source of ["manual", "geometry"] as const) {
      for (const corrected of [false, true]) expect(ghostLabel(trap({ source }), corrected).toLowerCase()).not.toContain("common");
    }
  });
});

describe("featureMarks", () => {
  it("puts four hole dots along the long side of the holed face, just off the surface", () => {
    const [mark] = featureMarks([1.6, 39, 69.4], [{ type: "holes", face: "right" }]); // shelf 1
    expect(mark.positions).toHaveLength(4);
    for (const p of mark.positions) {
      expect(p[0]).toBeCloseTo(0.8 + 0.09);
      expect(p[1]).toBeCloseTo(0);
    }
    expect(mark.positions.map((p) => p[2] / 69.4)).toEqual([-0.3, -0.1, 0.1, 0.3].map((f) => expect.closeTo(f, 5)));
    expect(mark.radius).toBe(0.7);
  });

  it("shrinks the dots to fit a narrow face, and draws one stripe for a finished edge", () => {
    expect(featureMarks([139.4, 39, 1.2], [{ type: "holes", face: "top" }])[0].radius).toBeCloseTo(0.48);
    const [stripe] = featureMarks([139.4, 39, 3.8], [{ type: "finished-edge", face: "top" }]);
    expect(stripe.positions).toHaveLength(1);
    expect(stripe.length).toBeCloseTo(139.4 * 0.85);
    expect(stripe.longAxis).toBe(0);
  });

  it("draws nothing for a part with no features", () => {
    expect(featureMarks([10, 10, 10], [])).toEqual([]);
  });
});
