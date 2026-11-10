import sharp from "sharp";
import type { IImageOptimizer } from "@/application/ports/images";

const MAX_SIDE = 1600;
// Una foto de 5 MB puede declarar dimensiones absurdas y agotar la memoria al descomprimirse.
const MAX_INPUT_PIXELS = 100_000_000;

export class SharpImageOptimizer implements IImageOptimizer {
  constructor(private readonly maxInputPixels = MAX_INPUT_PIXELS) {}

  async toWebp(bytes: Uint8Array): Promise<Uint8Array> {
    const output = await sharp(bytes, { limitInputPixels: this.maxInputPixels })
      .rotate() // aplica la orientación del móvil antes de que se pierdan los metadatos
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return new Uint8Array(output);
  }
}
