import { createServer } from "node:http";

// Un WhatsApp de mentira para las pruebas: recibe lo que la web enviaría a Meta y lo guarda para comprobarlo.
export const FAKE_META_PORT = 3199;
const BASE = `http://localhost:${FAKE_META_PORT}`;

export function startFakeMeta(): Promise<() => Promise<void>> {
  const sent: unknown[] = [];
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/mensajes") return void res.end(JSON.stringify(sent));
    if (req.method === "DELETE" && req.url === "/mensajes") {
      sent.length = 0;
      return void res.end("[]");
    }
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      sent.push(JSON.parse(body || "null"));
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: `wamid.falso${sent.length}` }] }));
    });
  });
  return new Promise((resolve) =>
    server.listen(FAKE_META_PORT, () => resolve(() => new Promise<void>((done) => server.close(() => done())))),
  );
}

/** Lo que la web mandó a "Meta" desde la última limpieza. */
export async function sentToMeta(): Promise<{ to: string; type: string; text?: { body: string }; template?: { name: string } }[]> {
  return (await fetch(`${BASE}/mensajes`)).json();
}

export async function clearMeta(): Promise<void> {
  await fetch(`${BASE}/mensajes`, { method: "DELETE" });
}
