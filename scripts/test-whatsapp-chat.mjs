// Chat de terminal contra el webhook local de WhatsApp, firmado como lo firma Meta.
// Uso: npm run chat:whatsapp [-- 51922222222]   (escribe "salir" o Ctrl+C para terminar)
import { createHmac } from "node:crypto";
import { createInterface } from "node:readline/promises";
import pg from "pg";

const faltan = ["WHATSAPP_APP_SECRET", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_DISPLAY_NUMBER", "DATABASE_URL"].filter(
  (n) => !process.env[n],
);
if (faltan.length) {
  console.error(`Faltan variables en .env: ${faltan.join(", ")}`);
  process.exit(1);
}
const { WHATSAPP_APP_SECRET, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_DISPLAY_NUMBER, DATABASE_URL } = process.env;
const phone = process.argv[2] ?? "51911111111";
const pool = new pg.Pool({ connectionString: DATABASE_URL });
const rl = createInterface({ input: process.stdin, output: process.stdout });

// Con stdin canalado, readline emite todas las líneas de golpe: se encolan y se procesan en orden.
const queue = [];
let wake;
let closed = false;
rl.on("line", (l) => {
  queue.push(l);
  wake?.();
});
rl.on("close", () => {
  closed = true;
  wake?.();
});

let lastSeen = 0;
{
  const { rows } = await pool.query("select max(id) as id from assistant_messages where phone = $1", [phone]);
  lastSeen = Number(rows[0].id ?? 0);
}

console.log(`Chat con el webhook como ${phone}. Escribe "salir" para terminar.`);
while (true) {
  if (!queue.length) {
    if (closed) break;
    process.stdout.write("Tú: ");
    await new Promise((r) => (wake = r));
    wake = undefined;
    continue;
  }
  const line = queue.shift().trim();
  if (!process.stdin.isTTY) console.log(`Tú: ${line}`);
  if (line === "salir") break;
  if (!line) continue;

  const body = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: WHATSAPP_DISPLAY_NUMBER, phone_number_id: WHATSAPP_PHONE_NUMBER_ID },
              messages: [
                {
                  from: phone,
                  id: "wamid.chat" + Date.now(),
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: line },
                },
              ],
            },
          },
        ],
      },
    ],
  });
  const signature = "sha256=" + createHmac("sha256", WHATSAPP_APP_SECRET).update(body).digest("hex");
  const t0 = Date.now();
  let res;
  try {
    res = await fetch("http://localhost:3000/api/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json", "x-hub-signature-256": signature },
      body,
    });
  } catch (e) {
    console.log(`No se pudo conectar con http://localhost:3000: ${e.message}`);
    continue;
  }
  const ms = Date.now() - t0;
  if (res.status !== 200) {
    console.log(`HTTP ${res.status}: ${await res.text()}`);
    if (res.status === 404) console.log("(404: probablemente faltan variables WHATSAPP_* en .env del servidor)");
    continue;
  }
  const { rows } = await pool.query(
    "select id, role, content from assistant_messages where phone = $1 order by id desc limit 1",
    [phone],
  );
  const last = rows[0];
  if (last && last.role === "assistant" && Number(last.id) > lastSeen) {
    console.log(`Bot (${ms} ms): ${last.content}`);
  } else {
    console.log(
      "(Respondió el asistente básico o hubo un error: mira «asistente de IA sin respuesta» o «[WhatsApp Dev Reply]» en la consola de npm run dev)",
    );
  }
  if (last) lastSeen = Math.max(lastSeen, Number(last.id));
  const citas = await pool.query(
    `select a.status, to_char(a.starts_at at time zone 'America/Lima','YYYY-MM-DD HH24:MI') as inicio, b.name as barbero
     from appointments a join customers c on c.id = a.customer_id join barbers b on b.id = a.barber_id
     where c.phone = $1 and a.ends_at > now() order by a.starts_at`,
    [phone],
  );
  console.log(
    citas.rows.length ? citas.rows.map((c) => `Citas: ${c.status} ${c.inicio} con ${c.barbero}`).join("\n") : "Citas: ninguna",
  );
}
rl.close();
await pool.end();
