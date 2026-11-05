// Genera la clave del panel y las líneas para .env: `npm run panel:clave`.
import { randomBytes } from "node:crypto";
import { hashPassword } from "../src/infrastructure/auth/password.ts";

const password = randomBytes(12).toString("base64url");

console.log(`Clave del panel: ${password}`);
console.log("Guárdala ahora: solo se guarda su hash y no se puede recuperar.\n");
console.log("Añade esto a .env:");
console.log(`PANEL_PASSWORD_HASH=${await hashPassword(password)}`);
console.log(`PANEL_SESSION_SECRET=${randomBytes(32).toString("hex")}`);
