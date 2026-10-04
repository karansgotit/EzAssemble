import { PartsRequest, MAX_IMAGE_BASE64_CHARS, MAX_REQUEST_BYTES, requestBytes } from "@/schema";
import { get2dContext, jpegDataUrl } from "./canvas";

type ResizeImage = (base64: string, maxLongSide: number, quality: number) => Promise<string>;

const resizeImage: ResizeImage = async (base64, maxLongSide, quality) => {
  const image = new Image();
  image.src = jpegDataUrl(base64);
  await image.decode();
  const scale = Math.min(1, maxLongSide / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  try {
    get2dContext(canvas).drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality).split(",")[1];
  } finally {
    canvas.width = canvas.height = 0;
  }
};

// Run before POST /api/parts. Keep every parts page, cover and step thumbnail, shrinking
// sequentially to bound memory. Throws a readable error if even the smallest set cannot fit.
export async function preparePartsRequest(input: PartsRequest, resize: ResizeImage = resizeImage): Promise<PartsRequest> {
  let candidate = { ...input, partsPages: [...input.partsPages], stepThumbs: [...input.stepThumbs] };
  const fits = () => requestBytes(candidate) <= MAX_REQUEST_BYTES &&
    [candidate.cover, ...candidate.partsPages, ...candidate.stepThumbs].every(image => image.length <= MAX_IMAGE_BASE64_CHARS);
  const validate = () => PartsRequest.parse(candidate);
  if (fits()) return validate();

  for (const [maxLongSide, quality] of [[1200, 0.8], [1000, 0.7], [800, 0.6]] as const) {
    const partsPages: string[] = [], stepThumbs: string[] = [];
    for (const image of input.partsPages) partsPages.push(await resize(image, maxLongSide, quality));
    const cover = await resize(input.cover, maxLongSide, quality);
    for (const image of input.stepThumbs) stepThumbs.push(await resize(image, 512, quality));
    candidate = { ...input, partsPages, cover, stepThumbs };
    if (fits()) return validate();
  }
  throw new Error("This manual's images still exceed the upload limit. Use a smaller manual or fewer pages; no AI request was sent.");
}
