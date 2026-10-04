import { describe, expect, it, vi } from "vitest";
import { preparePartsRequest } from "@/client/partsRequest";
import { PartsRequest, MAX_REQUEST_BYTES, requestBytes } from "@/schema";

const small: PartsRequest = { title: "Manual", productSizeCm: [77, 147, 39], partsPages: ["/9j/"], cover: "/9j/", stepThumbs: ["/9j/"] };
const large: PartsRequest = { ...small, partsPages: ["A".repeat(1_500_000), "B".repeat(1_500_000)], cover: "C".repeat(1_500_000), stepThumbs: ["D".repeat(1_500_000)] };

describe("complete image request budget", () => {
  it("rejects an oversized aggregate even when individual images meet their limit", () => {
    expect(requestBytes(large)).toBeGreaterThan(MAX_REQUEST_BYTES);
    expect(PartsRequest.safeParse(large).success).toBe(false);
  });
  it("measures UTF-8 bytes, not JS string length", () => {
    expect(requestBytes({ title: "é" })).toBe(Buffer.byteLength(JSON.stringify({ title: "é" })));
  });
  it("accepts the exact aggregate limit and rejects one byte beyond it", () => {
    const exact = { ...small, title: small.title + "A".repeat(MAX_REQUEST_BYTES - requestBytes(small)) };
    expect(requestBytes(exact)).toBe(MAX_REQUEST_BYTES);
    expect(PartsRequest.safeParse(exact).success).toBe(true);
    expect(PartsRequest.safeParse({ ...exact, title: exact.title + "A" }).success).toBe(false);
  });
  it("preserves requests that already fit without decoding images", async () => {
    const resize = vi.fn();
    expect(await preparePartsRequest(small, resize)).toEqual(small);
    expect(resize).not.toHaveBeenCalled();
  });
  it("shrinks all images and retains parts pages and thumbnail order", async () => {
    const resize = vi.fn(async (image: string) => image.slice(0, 500_000));
    const out = await preparePartsRequest(large, resize);
    expect(requestBytes(out)).toBeLessThanOrEqual(MAX_REQUEST_BYTES);
    expect(out.partsPages.map(s => s[0])).toEqual(["A", "B"]);
    expect(out.stepThumbs.map(s => s[0])).toEqual(["D"]);
    expect(out.cover[0]).toBe("C");
    expect(resize).toHaveBeenLastCalledWith(large.stepThumbs[0], 512, 0.8);
    expect(large.cover).toHaveLength(1_500_000);
  });
  it("also shrinks a single over-limit image in a small aggregate", async () => {
    const input = { ...small, cover: "A".repeat(1_500_001) };
    expect(PartsRequest.safeParse(input).success).toBe(false);
    const out = await preparePartsRequest(input, async () => "/9j/");
    expect(PartsRequest.safeParse(out).success).toBe(true);
  });
  it("tries bounded compression levels, then fails clearly instead of returning an oversized request", async () => {
    const resize = vi.fn(async (image: string) => image);
    await expect(preparePartsRequest(large, resize)).rejects.toThrow("no AI request was sent");
    expect(resize).toHaveBeenCalledTimes(12);
  });
});
