import { canvasToJpegBase64 } from "./canvas";

export type PageImage = { pageNumber: number; jpegBase64: string; width: number; height: number };

/** A problem with the uploaded file. `message` is written for the user and shown as is. */
export class PdfError extends Error {
  override name = "PdfError";
}

const DEFAULT_MAX_LONG_SIDE = 1600;
const PDF_HEADER = "%PDF-";

// pdf.js touches browser globals when it loads, so it's imported on first use, never on the server.
async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  return pdfjs;
}

async function hasPdfHeader(file: File): Promise<boolean> {
  // The spec allows a little junk before the header; pdf.js looks in the first 1024 bytes too.
  const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  return String.fromCharCode(...head).includes(PDF_HEADER);
}

function toPdfError(error: unknown): PdfError {
  const name = error instanceof Error ? error.name : "";
  if (name === "PasswordException") {
    return new PdfError("This PDF is password-protected. Upload a copy without a password.");
  }
  if (name === "InvalidPDFException") {
    return new PdfError("We couldn't read this PDF. The file may be damaged.");
  }
  return new PdfError("We couldn't read this PDF.");
}

/**
 * Renders every page of a PDF to a JPEG whose long side is `maxLongSide` px (default 1600).
 * Browser only. Throws `PdfError` with a readable message for a bad file.
 */
export async function rasterize(file: File, opts: { maxLongSide?: number } = {}): Promise<PageImage[]> {
  const maxLongSide = opts.maxLongSide ?? DEFAULT_MAX_LONG_SIDE;

  if (file.size === 0) throw new PdfError("This file is empty.");
  if (!(await hasPdfHeader(file))) throw new PdfError("This file isn't a PDF. Upload the assembly manual as a PDF.");

  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await loadingTask.promise.catch((error: unknown) => {
      throw toPdfError(error);
    });
    if (pdf.numPages < 1) throw new PdfError("This PDF has no pages.");

    const canvas = document.createElement("canvas");
    const pages: PageImage[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: maxLongSide / Math.max(base.width, base.height) });
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      // "print" makes pdf.js draw without waiting for screen refreshes, so pages keep rendering
      // when the tab is in the background. On screen-refresh pacing the upload stalls there.
      await page.render({ canvas, viewport, intent: "print" }).promise;
      pages.push({ pageNumber, jpegBase64: canvasToJpegBase64(canvas), width: canvas.width, height: canvas.height });
      page.cleanup();
    }
    canvas.width = 0;
    canvas.height = 0;
    return pages;
  } catch (error) {
    throw error instanceof PdfError ? error : toPdfError(error);
  } finally {
    await loadingTask.destroy();
  }
}
