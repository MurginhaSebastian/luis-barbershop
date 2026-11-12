// Prepara un video para la portada: `npm run media:video -- <entrada> --horizontal|--vertical [--inicio 3]`.
// Horizontal: public/videos/corte-escritorio.mp4 y su póster .jpg. Vertical (móvil): public/videos/corte-movil.mp4.
// Necesita ffmpeg y ffprobe en el PATH (en Windows: `winget install Gyan.FFmpeg`).
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";

const SECONDS = 10;
const FORMATS = {
  horizontal: { out: "public/videos/corte-escritorio", width: 1280, height: 720, poster: true },
  vertical: { out: "public/videos/corte-movil", width: 720, height: 1280, poster: false },
};

const [input, ...flags] = process.argv.slice(2);
const kind = flags.includes("--vertical") ? "vertical" : flags.includes("--horizontal") ? "horizontal" : null;
const start = flags.includes("--inicio") ? Number(flags[flags.indexOf("--inicio") + 1]) : 0;
if (!input || input.startsWith("--") || !kind || !Number.isFinite(start) || start < 0) {
  console.error("Uso: npm run media:video -- <video> --horizontal|--vertical [--inicio <segundos>]");
  process.exit(1);
}
const { out, width, height, poster } = FORMATS[kind];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error?.code === "ENOENT") {
    console.error(`No se encuentra ${command}. En Windows: winget install Gyan.FFmpeg (y abre una terminal nueva).`);
    process.exit(1);
  }
  if (result.status !== 0) {
    console.error(String(result.stderr).slice(-2000));
    process.exit(1);
  }
  return result.stdout;
}

// Recorta al encuadre, 10 s sin sonido, H.264 Main en yuv420p (lo que reproduce cualquier iPhone) y el índice
// al principio (+faststart) para que empiece a verse antes de terminar de bajar.
run("ffmpeg", [
  "-y", "-v", "error", "-ss", String(start), "-i", input, "-t", String(SECONDS), "-an",
  "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p`,
  "-c:v", "libx264", "-profile:v", "main", "-preset", "slow", "-crf", "28", "-movflags", "+faststart",
  `${out}.mp4`,
]);

if (poster) {
  // El primer fotograma: es lo que se ve hasta que el video arranca, así no hay salto.
  const frame = run("ffmpeg", ["-v", "error", "-i", `${out}.mp4`, "-frames:v", "1", "-f", "image2pipe", "-c:v", "png", "-"]);
  await sharp(frame).jpeg({ quality: 72, progressive: true, mozjpeg: true }).toFile(`${out}.jpg`);
}

// Autocomprobación: si algo no cumple, el video no sirve para la portada.
const probe = JSON.parse(
  String(run("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,profile,pix_fmt,width,height:format=duration", "-of", "json", `${out}.mp4`])),
);
const [video, ...others] = probe.streams;
const head = readFileSync(`${out}.mp4`).subarray(0, 1024 * 1024);
const problems = [
  video.codec_name !== "h264" && `códec ${video.codec_name}`,
  video.profile !== "Main" && `perfil ${video.profile}`,
  video.pix_fmt !== "yuv420p" && `píxeles ${video.pix_fmt}`,
  (video.width !== width || video.height !== height) && `tamaño ${video.width}x${video.height}`,
  Math.abs(Number(probe.format.duration) - SECONDS) > 0.2 && `duración ${probe.format.duration}`,
  others.length > 0 && "lleva otras pistas (¿audio?)",
  !(head.includes("moov") && (!head.includes("mdat") || head.indexOf("moov") < head.indexOf("mdat"))) && "sin +faststart",
].filter(Boolean);
if (problems.length) {
  console.error(`El video no cumple: ${problems.join(", ")}.`);
  process.exit(1);
}
const size = (file) => `${(readFileSync(file).length / 1024 / 1024).toFixed(2)} MB`;
console.log(`${out}.mp4: ${width}x${height}, ${SECONDS} s, H.264 Main, ${size(`${out}.mp4`)}${poster ? ` + póster ${out}.jpg` : ""}`);
