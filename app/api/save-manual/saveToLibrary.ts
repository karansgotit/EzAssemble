// Writes a processed manual into the library folder (public/manuals/). Used only by the dev-only route.
// The folder is passed in, so tests can save into a temporary directory.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { LibraryIndex, type SaveManualRequest } from "@/schema";

export type SaveOutcome = { ok: true; path: string } | { ok: false; error: string };

// File names come from the browser, so only the exact form the app produces is accepted (no folders, no "..").
const CROP_NAME = /^step-\d{2,3}\.jpg$/;
const JPEG_START = "/9j/"; // every JPEG's first bytes, in base64

async function readIndex(file: string): Promise<LibraryIndex> {
  try {
    const parsed = LibraryIndex.safeParse(JSON.parse(await readFile(file, "utf8")));
    return parsed.success ? parsed.data : [];
  } catch {
    return []; // no index yet
  }
}

export async function saveToLibrary({ manual, crops }: SaveManualRequest, libraryDir: string): Promise<SaveOutcome> {
  const names = new Set(crops.map((crop) => crop.name));
  for (const crop of crops) {
    if (!CROP_NAME.test(crop.name)) return { ok: false, error: `"${crop.name}" is not a valid crop name (expected step-NN.jpg).` };
    if (!crop.base64.startsWith(JPEG_START)) return { ok: false, error: `${crop.name} is not a JPEG image.` };
  }
  // Every step that shows a diagram must have its image, or the saved manual opens with broken pictures.
  const needed = manual.steps.flatMap((step) => (step.status === "subassembly" ? [] : [step.crop]));
  const missing = needed.filter((crop) => !names.has(crop.replace(/^crops\//, "")));
  if (missing.length) return { ok: false, error: `Missing the image for ${missing.join(", ")}.` };

  const manualDir = path.join(libraryDir, manual.id);
  await mkdir(path.join(manualDir, "crops"), { recursive: true });
  for (const crop of crops) await writeFile(path.join(manualDir, "crops", crop.name), Buffer.from(crop.base64, "base64"));
  await writeFile(path.join(manualDir, "manual.json"), `${JSON.stringify(manual, null, 2)}\n`);

  // Add this manual to the list the home page reads, replacing an older entry with the same id.
  const indexFile = path.join(libraryDir, "index.json");
  const entry = { id: manual.id, title: manual.title, stepCount: manual.steps.length, thumbnail: needed[0] ?? "", createdAt: manual.createdAt };
  const index = await readIndex(indexFile);
  const at = index.findIndex((item) => item.id === manual.id);
  if (at >= 0) index[at] = entry;
  else index.push(entry);
  await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`);

  return { ok: true, path: `public/manuals/${manual.id}/manual.json` };
}
