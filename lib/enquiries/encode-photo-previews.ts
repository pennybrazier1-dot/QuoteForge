import type { EnquiryPhotoPreview } from "@/lib/enquiries/types";

const MAX_PHOTOS = 6;
const MAX_OUTPUT_BYTES = 350_000;
const MAX_DIMENSION = 1280;

function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : null);
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(",")[1] ?? "";
  return Math.ceil((base64.length * 3) / 4);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image"));
    image.src = dataUrl;
  });
}

async function compressDataUrl(dataUrl: string, mimeType: string): Promise<string> {
  const image = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    return dataUrl;
  }

  context.drawImage(image, 0, 0, width, height);

  let quality = 0.82;
  let output = canvas.toDataURL(mimeType, quality);

  while (estimateDataUrlBytes(output) > MAX_OUTPUT_BYTES && quality > 0.45) {
    quality -= 0.08;
    output = canvas.toDataURL(mimeType, quality);
  }

  return output;
}

async function encodePhotoFile(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  const initialDataUrl = await readFileAsDataUrl(file);
  if (!initialDataUrl) {
    return null;
  }

  if (estimateDataUrlBytes(initialDataUrl) <= MAX_OUTPUT_BYTES) {
    return initialDataUrl;
  }

  try {
    const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
    return await compressDataUrl(initialDataUrl, mimeType);
  } catch {
    return initialDataUrl.length <= MAX_OUTPUT_BYTES * 1.25 ? initialDataUrl : null;
  }
}

export async function encodeJourneyPhotoPreviews(
  files: File[]
): Promise<EnquiryPhotoPreview[]> {
  if (typeof window === "undefined" || files.length === 0) {
    return [];
  }

  const previews: EnquiryPhotoPreview[] = [];

  for (const file of files.slice(0, MAX_PHOTOS)) {
    const dataUrl = await encodePhotoFile(file);
    if (!dataUrl) {
      continue;
    }

    previews.push({
      id: crypto.randomUUID(),
      name: file.name,
      dataUrl,
    });
  }

  return previews;
}
