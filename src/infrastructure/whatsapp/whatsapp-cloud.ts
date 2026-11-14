import { createHmac, timingSafeEqual } from "node:crypto";
import type { IMessagingService } from "@/application/ports/messaging";

export interface WhatsAppConfig {
  /** Token permanente de un usuario del sistema de Meta Business. */
  token: string;
  phoneNumberId: string;
  /** Secreto de la app: firma cada aviso que Meta envía al webhook. */
  appSecret: string;
  /** Lo eliges tú y lo escribes también en Meta al configurar el webhook. */
  verifyToken: string;
  /** El número conectado a la API, solo cifras: a él escriben los clientes para confirmar. No es el de Luis. */
  displayNumber: string;
  /** Solo para pruebas: otra dirección en lugar de la Graph API de Meta. */
  apiUrl?: string;
}

const GRAPH_API = "https://graph.facebook.com/v27.0";

/** WhatsApp Cloud API por fetch: sin SDK, como el envío de avisos push. */
export class WhatsAppCloudSender implements IMessagingService {
  constructor(
    private readonly config: Pick<WhatsAppConfig, "token" | "phoneNumberId" | "apiUrl">,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  sendText(toPhone: string, text: string): Promise<void> {
    return this.send({ to: `+${toPhone}`, type: "text", text: { body: text } });
  }

  sendTemplate(toPhone: string, template: string, parameters: readonly string[]): Promise<void> {
    return this.send({
      to: `+${toPhone}`,
      type: "template",
      template: {
        name: template,
        language: { code: "es" },
        components: [{ type: "body", parameters: parameters.map((text) => ({ type: "text", text })) }],
      },
    });
  }

  private async send(message: Record<string, unknown>): Promise<void> {
    const response = await this.fetchImpl(`${this.config.apiUrl ?? GRAPH_API}/${this.config.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...message }),
      signal: AbortSignal.timeout(10_000),
    });
    // Meta explica el motivo en el cuerpo (plantilla sin aprobar, ventana de 24 h cerrada…).
    if (!response.ok) throw new Error(`WhatsApp respondió ${response.status}: ${(await response.text()).slice(0, 300)}`);
  }
}

/** Sin estas cinco variables no hay WhatsApp: las citas se confirman a mano, como antes. */
export function readWhatsAppConfig(env: Record<string, string | undefined>): WhatsAppConfig | null {
  const {
    WHATSAPP_TOKEN: token,
    WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
    WHATSAPP_APP_SECRET: appSecret,
    WHATSAPP_VERIFY_TOKEN: verifyToken,
    WHATSAPP_API_URL: apiUrl,
  } = env;
  const displayNumber = env.WHATSAPP_DISPLAY_NUMBER?.replace(/\D/g, "");
  if (!token || !phoneNumberId || !appSecret || !verifyToken || !displayNumber) return null;
  return { token, phoneNumberId, appSecret, verifyToken, displayNumber, ...(apiUrl && { apiUrl }) };
}

/** ¿El aviso viene de Meta? HMAC-SHA256 del cuerpo tal cual llegó, con el secreto de la app. */
export function isSignedByMeta(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  const received = signatureHeader?.startsWith("sha256=") ? Buffer.from(signatureHeader.slice(7), "hex") : null;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return !!received && received.length === expected.length && timingSafeEqual(received, expected);
}
