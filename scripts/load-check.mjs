// Prueba de carga sencilla: `node scripts/load-check.mjs http://localhost:3000`, contra un `next start`.
const base = process.argv[2] ?? "http://localhost:3000";
const REQUESTS = 400;
const CONCURRENCY = 25;

async function run(path) {
  const times = [];
  let failures = 0;
  let next = 0;
  const started = performance.now();
  const worker = async () => {
    while (next++ < REQUESTS) {
      const t0 = performance.now();
      try {
        const response = await fetch(base + path);
        await response.text();
        if (!response.ok) failures++;
      } catch {
        failures++;
      }
      times.push(performance.now() - t0);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  times.sort((a, b) => a - b);
  const pct = (p) => Math.round(times[Math.floor(times.length * p)]);
  const seconds = (performance.now() - started) / 1000;
  console.log(
    `${path.padEnd(52)} ${String(Math.round(times.length / seconds)).padStart(4)} pet/s | p50 ${pct(0.5)} ms | p95 ${pct(0.95)} ms | máx ${Math.round(times.at(-1))} ms | fallos ${failures}`,
  );
  return failures;
}

const paths = [
  "/",
  "/reservar",
  `/reservar?paso=3&servicios=20000000-0000-4000-8000-000000000001&barbero=cualquiera`,
];
let failures = 0;
for (const path of paths) failures += await run(path);
process.exit(failures ? 1 : 0);
