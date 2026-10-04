// Image format sent to the API: base64 JPEG without the "data:" prefix (D-19, CONTRACTS §5).

export const JPEG_QUALITY = 0.85;

const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

export function jpegDataUrl(jpegBase64: string): string {
  return JPEG_DATA_URL_PREFIX + jpegBase64;
}

export function canvasToJpegBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY).slice(JPEG_DATA_URL_PREFIX.length);
}

export function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser couldn't create a 2D canvas.");
  return ctx;
}
