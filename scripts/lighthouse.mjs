// Mide la web con Lighthouse en Edge: `npm run lighthouse -- [url]` (por defecto http://localhost:3000).
// Mide el build real (`npm run build && npm start`): las cabeceras de seguridad solo existen en producción.
// Los informes completos quedan en .lighthouse/ (ábrelos en el navegador).
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";
import desktopConfig from "lighthouse/core/config/desktop-config.js";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const PAGES = ["/", "/reservar", "/panel/entrar"];
// El panel lleva noindex a propósito: su SEO bajo no es un fallo.
const PRIVATE = new Set(["/panel/entrar"]);
const DEVICES = [
  ["móvil", undefined],
  ["escritorio", desktopConfig],
];
/** Mínimos por categoría: por debajo, el comando falla. */
const MINIMUM = { performance: 85, accessibility: 95, "best-practices": 95, seo: 95 };
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const chromePath = process.env.CHROME_PATH ?? (existsSync(EDGE) ? EDGE : undefined);
const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new"] });
mkdirSync(".lighthouse", { recursive: true });

const rows = [];
const below = [];
try {
  for (const [device, config] of DEVICES) {
    for (const path of PAGES) {
      const { lhr, report } = await lighthouse(`${base}${path}`, { port: chrome.port, output: "html", logLevel: "error" }, config);
      writeFileSync(`.lighthouse/${device}${path === "/" ? "-portada" : path.replaceAll("/", "-")}.html`, report);
      const score = (id) => Math.round((lhr.categories[id]?.score ?? 0) * 100);
      rows.push({
        página: path,
        dispositivo: device,
        rendimiento: score("performance"),
        accesibilidad: score("accessibility"),
        "buenas prácticas": score("best-practices"),
        SEO: score("seo"),
      });
      for (const [id, min] of Object.entries(MINIMUM)) {
        if (score(id) >= min || (id === "seo" && PRIVATE.has(path))) continue;
        // Qué restó puntos, para saber por dónde empezar.
        const failing = lhr.categories[id].auditRefs
          .filter((ref) => ref.weight > 0 && (lhr.audits[ref.id].score ?? 1) < 0.9)
          .map((ref) => `${ref.id} (${lhr.audits[ref.id].displayValue ?? lhr.audits[ref.id].score})`);
        below.push(`${device} ${path}: ${id} ${score(id)} < ${min}. ${failing.join(", ")}`);
      }
    }
  }
} finally {
  await chrome.kill();
}

console.table(rows);
if (below.length) {
  console.error(`Por debajo del mínimo:\n${below.join("\n")}`);
  process.exit(1);
}
console.log("Todo por encima del mínimo. Informes en .lighthouse/");
