// The upload orchestrator: one PDF in, one SavedManual out, with progress events along the way.
// Runs in the browser. Flow A in docs/ARCHITECTURE.md §5.
import { buildSceneManual, toBuildSize } from "@/scene/buildSceneManual";
import { checkConsistency } from "@/scene/consistency";
import { snapLayout } from "@/scene/layout";
import {
  checkCumulativeCounts,
  type PageIndex,
  type PartsLayout,
  placedPartsAfterStep,
  SavedManual,
  type SavedStep,
  type Step,
  type Usage,
  type Vec3,
} from "@/schema";
import { type Api, getApi } from "./api";
import { cropBox } from "./crop";
import { cropName, countUnits, listNumbers, mapLimit, missingStepNumbers, pickSteps, planSteps, subassemblyMessage, totalUsage } from "./processSteps";
import { type PageImage, rasterize } from "./rasterize";

export type ProcessEvent =
  | { type: "stage"; stage: "rasterize" | "index" | "parts" | "steps" | "done"; detail?: string }
  | { type: "progress"; done: number; total: number }
  | { type: "manual"; manual: SavedManual } // emitted after every finished step (streaming)
  | { type: "pages"; pages: PageImage[] } // emitted once, when the PDF is read: every page as an image, for the waiting screen
  | { type: "crops"; crops: Crop[] } // emitted once, when the step images are cut; needed to show and save them
  | { type: "error"; message: string };

export type Crop = { name: string; base64: string };
export type ProcessInput = { file: File; title: string; id: string; productSizeCm: Vec3 };

/** `signal` cancels the run. The other two exist so tests can run without a browser canvas. */
export type ProcessOptions = { signal?: AbortSignal; rasterize?: typeof rasterize; cropBox?: typeof cropBox };

/** Thrown when processing can't continue. The same message was already sent as an "error" event. */
export class ProcessError extends Error {
  override name = "ProcessError";
}

const INDEX_CONCURRENCY = 4;
const THUMB_LONG_SIDE = 512;

export async function processManual(
  input: ProcessInput,
  onEvent: (event: ProcessEvent) => void,
  api: Api = getApi(),
  options: ProcessOptions = {},
): Promise<SavedManual> {
  const { signal } = options;
  const usage: Usage[] = [];
  // Typed as a variable so TypeScript treats a call as "nothing after this runs".
  const stop: (message: string) => never = (message) => {
    onEvent({ type: "error", message });
    throw new ProcessError(message);
  };
  const checkCancelled = () => {
    if (signal?.aborted) stop("Cancelled.");
  };

  // A1. PDF → page images
  onEvent({ type: "stage", stage: "rasterize" });
  let pageImages: PageImage[] = [];
  try {
    pageImages = await (options.rasterize ?? rasterize)(input.file);
  } catch (error) {
    stop(error instanceof Error ? error.message : "We couldn't read this PDF.");
  }
  checkCancelled();
  onEvent({ type: "pages", pages: pageImages });

  // A2. Every page → its type and step boxes, 4 at a time
  onEvent({ type: "stage", stage: "index" });
  let indexed = 0;
  const skippedPages: number[] = [];
  const pages: PageIndex[] = await mapLimit(pageImages, INDEX_CONCURRENCY, async (page) => {
    const result = signal?.aborted ? null : await api.indexPage({ image: page.jpegBase64, pageNumber: page.pageNumber }, { signal });
    if (result) usage.push(...result.usage);
    onEvent({ type: "progress", done: ++indexed, total: pageImages.length });
    if (result?.ok) return result.data;
    skippedPages.push(page.pageNumber);
    return { pageType: "other", steps: [] };
  });
  checkCancelled();

  // Every page failing is not "a PDF with no steps": the AI never answered (routes down, no credentials, offline).
  if (skippedPages.length === pageImages.length) stop("The AI service that reads manuals didn't answer, so this manual couldn't be analysed. Try again in a moment.");

  // A3. One entry per step number; sub-assembly runs collapse into one card
  const refs = pickSteps(pages);
  if (refs.length === 0) stop("No assembly steps were found in this PDF. Is it an IKEA assembly manual?");
  const problems: string[] = [];
  if (skippedPages.length) problems.push(`Page${skippedPages.length > 1 ? "s" : ""} ${listNumbers(skippedPages.sort((a, b) => a - b))} couldn't be read.`);
  const missing = missingStepNumbers(refs);
  if (missing.length) problems.push(`Step${missing.length > 1 ? "s" : ""} ${listNumbers(missing)} not found.`);
  if (problems.length) onEvent({ type: "stage", stage: "index", detail: problems.join(" ") });
  const plan = planSteps(refs);

  // A4. Cut each analysed step out of its page, plus a small copy for the parts call
  const crop = options.cropBox ?? cropBox;
  const crops = new Map<number, string>();
  const thumbs: string[] = [];
  for (const planned of plan) {
    if (planned.kind !== "analyse") continue;
    checkCancelled();
    const page = pageImages[planned.ref.pageNumber - 1];
    crops.set(planned.ref.stepNumber, await crop(page, planned.ref.box));
    thumbs.push(await crop(page, planned.ref.box, { maxLongSide: THUMB_LONG_SIDE }));
  }
  onEvent({ type: "crops", crops: [...crops].map(([stepNumber, base64]) => ({ name: cropName(stepNumber), base64 })) });
  checkCancelled();

  // A5 + A6. Parts and rough layout, once; one more try if our geometry can't make it sound
  onEvent({ type: "stage", stage: "parts" });
  const firstStepsPage = pages.findIndex((page) => page.pageType === "steps");
  const partsPageNumbers = pages.flatMap((page, i) => (page.pageType === "parts" ? [i + 1] : []));
  if (partsPageNumbers.length === 0) partsPageNumbers.push(Math.max(firstStepsPage, 1)); // the page before the first steps page
  const coverIndex = Math.max(pages.findIndex((page) => page.pageType === "cover"), 0);
  const partsRequest = {
    title: input.title,
    productSizeCm: input.productSizeCm,
    partsPages: partsPageNumbers.map((n) => pageImages[n - 1].jpegBase64),
    cover: pageImages[coverIndex].jpegBase64,
    stepThumbs: thumbs,
  };
  const firstParts = await api.parts(partsRequest, { signal });
  usage.push(...firstParts.usage);
  checkCancelled();
  if (!firstParts.ok) {
    console.warn("[processManual] the parts call failed:", firstParts.errors);
    stop("Couldn't identify the parts in this manual.");
  }
  let layout: PartsLayout = firstParts.data;
  let snapped = snapLayout(layout, toBuildSize(input.productSizeCm, layout.buildOrientation));
  if (!snapped.ok) {
    const retry = await api.parts({ ...partsRequest, previousErrors: snapped.errors }, { signal });
    usage.push(...retry.usage);
    checkCancelled();
    if (retry.ok) {
      const resnapped = snapLayout(retry.data, toBuildSize(input.productSizeCm, retry.data.buildOrientation));
      if (resnapped.ok || resnapped.errors.length < snapped.errors.length) {
        layout = retry.data;
        snapped = resnapped;
      }
    }
  }

  // A7. Steps in order: each call is told what is already built
  onEvent({ type: "stage", stage: "steps" });
  const createdAt = new Date().toISOString();
  const steps: SavedStep[] = [];
  const snapshot = (): SavedManual => ({
    schemaVersion: 1,
    id: input.id,
    title: input.title,
    productSizeCm: input.productSizeCm,
    pages,
    layout,
    steps: [...steps],
    createdAt,
    usage: totalUsage(usage),
  });
  let placedPartIds: string[] = [];
  const previousInstructions: string[] = [];

  for (const [i, planned] of plan.entries()) {
    checkCancelled();
    if (planned.kind === "subassembly") {
      steps.push({
        status: "subassembly",
        stepNumber: planned.sourceSteps[0],
        sourceSteps: planned.sourceSteps,
        label: planned.label,
        message: subassemblyMessage(planned.label, planned.sourceSteps, countUnits(planned.label, layout.parts)),
      });
    } else {
      const { stepNumber } = planned.ref;
      onEvent({ type: "stage", stage: "steps", detail: `Analysing step ${stepNumber}` });
      const result = await api.analyzeStep(
        { image: crops.get(stepNumber) ?? "", stepNumber, parts: layout.parts, placedPartIds, previousInstructions: [...previousInstructions] },
        { signal },
      );
      usage.push(...result.usage);
      checkCancelled();
      const cropPath = `crops/${cropName(stepNumber)}`;
      if (result.ok) {
        steps.push({ status: "ok", step: result.data, crop: cropPath, attempts: result.attempts });
        placedPartIds = placedPartsAfterStep(result.data, layout.parts, placedPartIds);
        previousInstructions.push(result.data.instruction);
      } else {
        steps.push({ status: "failed", stepNumber, crop: cropPath, errors: result.errors, attempts: result.attempts });
      }
    }
    onEvent({ type: "progress", done: i + 1, total: plan.length });
    onEvent({ type: "manual", manual: snapshot() });
  }

  // A8. Checks across the whole manual: doubtful steps are marked, never dropped
  const okSteps: Step[] = steps.flatMap((saved) => (saved.status === "ok" ? [saved.step] : []));
  const doubtful = new Set(checkCumulativeCounts(okSteps, layout.parts).map((problem) => problem.stepNumber));
  // A step that places a part against something it does not touch in the snapped layout is suspect too.
  for (const problem of checkConsistency(buildSceneManual(snapshot(), "").manual)) doubtful.add(problem.stepNumber);
  for (const [i, saved] of steps.entries()) {
    const unsure = saved.status === "ok" && saved.step.kind === "assembly" && (doubtful.has(saved.step.stepNumber) || !snapped.ok);
    if (unsure) steps[i] = { ...saved, step: { ...saved.step, confidence: "low" } };
  }

  const finished = SavedManual.safeParse(snapshot());
  if (!finished.success) stop("The processed manual came out in an unexpected shape, so it can't be shown.");
  const manual = finished.data;
  onEvent({ type: "manual", manual });
  onEvent({ type: "stage", stage: "done" });
  return manual;
}
