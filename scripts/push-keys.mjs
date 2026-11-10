// Genera las claves VAPID de los avisos push: `npm run panel:push`. Se generan una vez por web.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("Añade esto a .env (cambia el correo por uno de contacto de la barbería):");
console.log("VAPID_SUBJECT=mailto:contacto@example.com");
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("\nSi las cambias, los dispositivos tendrán que volver a activar los avisos.");
