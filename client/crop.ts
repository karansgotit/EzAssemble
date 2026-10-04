import { canvasToJpegBase64, get2dContext } from "./canvas";

/** A step box from call 1: [ymin, xmin, ymax, xmax] on a 0–1000 scale of the page (CONTRACTS §2.1). */
export type Box = [number, number, number, number];
export type PixelRect = { x: number; y: number; width: number; height: number };
export type CropOptions = { padFrac?: number; maxLongSide?: number };

const BOX_SCALE = 1000;
const DEFAULT_PAD_FRAC = 0.02;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Pure: box → pixel rect on a page of the given size.
 * The padding is `padFrac` of the PAGE size on every side, and the result is clamped to the page.
 * Never throws: a reversed box is reordered, an unusable one gives the whole page.
 */
export function boxToPixelRect(
  box: Box,
  pageWidth: number,
  pageHeight: number,
  padFrac: number = DEFAULT_PAD_FRAC,
): PixelRect {
  const wholePage = { x: 0, y: 0, width: pageWidth, height: pageHeight };
  if (!box.every(Number.isFinite)) return wholePage;

  // Stay in box units until the last step, so whole-number boxes give whole-number pixels.
  const pad = (Number.isFinite(padFrac) ? Math.max(padFrac, 0) : DEFAULT_PAD_FRAC) * BOX_SCALE;
  const [ymin, ymax] = [box[0], box[2]].sort((a, b) => a - b).map((v) => clamp(v, 0, BOX_SCALE));
  const [xmin, xmax] = [box[1], box[3]].sort((a, b) => a - b).map((v) => clamp(v, 0, BOX_SCALE));

  // Keep at least 1 px, so a degenerate box still gives a drawable rect inside the page.
  const left = clamp(Math.floor(((xmin - pad) * pageWidth) / BOX_SCALE), 0, pageWidth - 1);
  const top = clamp(Math.floor(((ymin - pad) * pageHeight) / BOX_SCALE), 0, pageHeight - 1);
  const right = clamp(Math.ceil(((xmax + pad) * pageWidth) / BOX_SCALE), left + 1, pageWidth);
  const bottom = clamp(Math.ceil(((ymax + pad) * pageHeight) / BOX_SCALE), top + 1, pageHeight);

  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** Pure: the same shape, shrunk so its long side is ≤ `maxLongSide`. Never enlarges. */
export function fitLongSide(width: number, height: number, maxLongSide?: number): { width: number; height: number } {
  const longSide = Math.max(width, height);
  if (!maxLongSide || maxLongSide <= 0 || longSide <= maxLongSide) return { width, height };
  const scale = maxLongSide / longSide;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

// Steps on one page are cropped one after another (and twice each: full size and thumbnail),
// so the last decoded page is kept instead of decoding it again for every crop.
let lastDecoded: { jpegBase64: string; image: Promise<ImageBitmap> } | null = null;

// createImageBitmap decodes off the main thread and keeps working while the tab is in the background.
// An <img> element's decode() waits for the tab to be visible, which stalled an upload when the user looked away.
function decodeJpeg(jpegBase64: string): Promise<ImageBitmap> {
  if (lastDecoded?.jpegBase64 !== jpegBase64) {
    const bytes = Uint8Array.from(atob(jpegBase64), (char) => char.charCodeAt(0));
    lastDecoded = { jpegBase64, image: createImageBitmap(new Blob([bytes], { type: "image/jpeg" })) };
  }
  return lastDecoded.image;
}

/** Cuts a step out of its page image. Returns base64 JPEG without the "data:" prefix. */
export async function cropBox(
  page: { jpegBase64: string; width: number; height: number },
  box: Box,
  opts: CropOptions = {},
): Promise<string> {
  const rect = boxToPixelRect(box, page.width, page.height, opts.padFrac);
  const out = fitLongSide(rect.width, rect.height, opts.maxLongSide);
  const image = await decodeJpeg(page.jpegBase64);

  const canvas = document.createElement("canvas");
  canvas.width = out.width;
  canvas.height = out.height;
  const ctx = get2dContext(canvas);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, out.width, out.height);
  return canvasToJpegBase64(canvas);
}
