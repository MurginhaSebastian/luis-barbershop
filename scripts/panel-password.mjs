// Clave del panel y las líneas para .env: `npm run panel:clave`. Pide tu clave; con Enter genera una aleatoria.
// Se pregunta en vez de recibirla como argumento para que no quede en el historial de la terminal.
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../src/infrastructure/auth/password.ts";

const MIN_LENGTH = 10;

let typed = "";
if (process.stdin.isTTY) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  typed = await rl.question(`Escribe tu clave (mínimo ${MIN_LENGTH} caracteres; Enter = una aleatoria): `);
  rl.close();
}

const chosen = typed.trim() !== "";
if (chosen && typed.length < MIN_LENGTH) {
  console.error(`La clave debe tener al menos ${MIN_LENGTH} caracteres. No se cambió nada.`);
  process.exit(1);
}
const password = chosen ? typed : randomBytes(12).toString("base64url");

if (!chosen) {
  console.log(`Clave del panel: ${password}`);
  console.log("Guárdala ahora: solo se guarda su hash y no se puede recuperar.\n");
}
console.log("Reemplaza en .env estas dos líneas:");
console.log(`PANEL_PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`PANEL_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
