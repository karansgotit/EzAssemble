// Pure rules for the upload page: the user only chooses a PDF, so everything else is worked out here.
import type { ProcessEvent } from "./processManual";

/**
 * TEMPORARY. The pipeline needs the assembled size (cm, upright: width × height × depth) to turn the AI's
 * fractions into centimetres, and nothing supplies it yet: the user is not asked, and the parts call does
 * not return it. Until the parts call does (a CONTRACT change, see docs/tasks/smit.md SMI-07), every upload
 * is treated as a KALLAX 2×4. That is right for the mock, and wrong in proportion for any other furniture.
 */
export const INTERIM_PRODUCT_SIZE_CM: [number, number, number] = [77, 147, 39];

const MAX_ID_LENGTH = 40;

/** "KALLAX 2×4 shelving unit" → "kallax-2x4-shelving-unit": lowercase letters, digits and dashes, at most 40. */
export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // accents: "Ä" → "A"
    .replace(/×/g, "x")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_ID_LENGTH)
    .replace(/-+$/, "");
}

/**
 * A readable title from the file name. IKEA's own downloads are named like
 * "malm-bed-frame-white__AA-2558683-1-100.pdf", which gives "MALM bed frame white".
 */
export function titleFromFileName(fileName: string): string {
  const words = fileName
    .replace(/\.pdf$/i, "")
    .replace(/__.*$/, "") // IKEA's document number and revision
    .replace(/[-_]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "Uploaded manual";
  // IKEA writes product names in capitals; the rest reads better in lowercase.
  return [words[0].toUpperCase(), ...words.slice(1).map((word) => word.toLowerCase())].join(" ");
}

/** The id a saved manual would get. Always valid for SavedManual. */
export function idFromTitle(title: string): string {
  return slugify(title) || "manual";
}

/** Why this file can't be uploaded, or null when it can. The PDF itself is checked again while it is read. */
export function fileProblem(file: { name: string; size: number }): string | null {
  if (file.size === 0) return "This file is empty.";
  if (!file.name.toLowerCase().endsWith(".pdf")) return "This file isn't a PDF. Upload the assembly manual as a PDF.";
  return null;
}

type Stage = Extract<ProcessEvent, { type: "stage" }>["stage"];
type Count = { done: number; total: number };

/** What the waiting screen says for each stage (FR-20). */
export function stageLabel(stage: Stage, progress: Count | null): string {
  const count = progress && progress.total > 0 ? progress : null;
  switch (stage) {
    case "rasterize":
      return "Reading the PDF";
    case "index":
      if (count && count.done >= count.total) return "Cutting out the steps"; // every page is indexed; cropping has no stage of its own
      return count ? `Finding the steps · page ${count.done + 1} of ${count.total}` : "Finding the steps";
    case "parts":
      return "Identifying the parts";
    case "steps":
      return count ? `Analysing step ${Math.min(count.done + 1, count.total)} of ${count.total}` : "Analysing the steps";
    case "done":
      return "Done";
  }
}

// Share of the whole wait each stage takes, roughly (docs/ARCHITECTURE.md §5): the steps dominate.
const STAGE_SPAN: Record<Stage, [start: number, end: number]> = {
  rasterize: [0, 0.03],
  index: [0.03, 0.2],
  parts: [0.2, 0.28],
  steps: [0.28, 1],
  done: [1, 1],
};

/** One number for the loading bar, 0..1, that only moves forward across the whole run. */
export function overallProgress(stage: Stage, progress: Count | null): number {
  const [start, end] = STAGE_SPAN[stage];
  const within = progress && progress.total > 0 ? Math.min(Math.max(progress.done / progress.total, 0), 1) : 0;
  return start + (end - start) * within;
}

export function formatUsd(amount: number | undefined): string {
  return `$${(amount ?? 0).toFixed(2)}`;
}
