import { InvalidImageError } from "../errors/domain-errors";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, i) => bytes[offset + i] === byte);

/** El tipo real por los primeros bytes: la extensión y el tipo que declara el navegador se pueden falsear. */
export function detectImageType(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  // "RIFF" ···· "WEBP"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp";
  return null;
}

export function assertValidImage(bytes: Uint8Array) {
  if (bytes.length === 0) throw new InvalidImageError("El archivo está vacío.");
  if (bytes.length > MAX_IMAGE_BYTES) throw new InvalidImageError("La foto pesa más de 5 MB.");
  if (!detectImageType(bytes)) throw new InvalidImageError("Solo se aceptan fotos JPG, PNG o WebP.");
}
