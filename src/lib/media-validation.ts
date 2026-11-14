import { z } from "zod";

export const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
export const uuidSchema = z.uuid();
export const mediaInputSchema = z.object({
  treeId: uuidSchema,
  mediaId: uuidSchema,
});
export const mediaPersonSchema = mediaInputSchema.extend({ personId: uuidSchema });

export function validatePhoto(bytes: Uint8Array, mimeType: string, size: number): string | null {
  if (!Number.isInteger(size) || size < 1 || size > MAX_PHOTO_SIZE) return "La fotografía debe ocupar entre 1 byte y 10 MB.";
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, i) => bytes[i] === value);
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!((mimeType === "image/jpeg" && jpeg) || (mimeType === "image/png" && png) || (mimeType === "image/webp" && webp))) {
    return "Solo se permiten fotografías JPEG, PNG o WebP válidas.";
  }
  return null;
}
