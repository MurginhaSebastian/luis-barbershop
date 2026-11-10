import { describe, expect, test } from "vitest";
import { InvalidImageError } from "../errors/domain-errors";
import { assertValidImage, detectImageType, MAX_IMAGE_BYTES } from "./image";

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (s: string) => new TextEncoder().encode(s);
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0);
const WEBP = new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WEBPVP8 ")]);

describe("detectImageType", () => {
  test("reconoce JPEG, PNG y WebP por su contenido", () => {
    expect(detectImageType(JPEG)).toBe("jpeg");
    expect(detectImageType(PNG)).toBe("png");
    expect(detectImageType(WEBP)).toBe("webp");
  });

  test.each([
    ["HTML disfrazado", text("<html><script>alert(1)</script>")],
    ["SVG, que puede llevar código", text('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>')],
    ["un RIFF que no es WebP (audio WAV)", new Uint8Array([...text("RIFF"), 0, 0, 0, 0, ...text("WAVEfmt ")])],
    ["GIF", text("GIF89a")],
    ["vacío", bytes()],
  ])("no acepta %s", (_, content) => {
    expect(detectImageType(content)).toBeNull();
  });
});

describe("assertValidImage", () => {
  test("acepta una imagen dentro del límite", () => {
    expect(() => assertValidImage(JPEG)).not.toThrow();
  });

  test("rechaza lo vacío, lo enorme y lo que no es foto", () => {
    expect(() => assertValidImage(bytes())).toThrow(InvalidImageError);
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(JPEG);
    expect(() => assertValidImage(big)).toThrow("5 MB");
    expect(() => assertValidImage(text("no soy una foto"))).toThrow("JPG, PNG o WebP");
  });
});
