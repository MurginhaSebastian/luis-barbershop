import { describe, expect, it } from "vitest";
import { humanHandoffText, quickReplyKind } from "./quick-replies";

describe("quickReplyKind", () => {
  it.each(["Quiero hablar con Luis", "puedo hablar con el barbero?", "quiero comunicarme con una persona", "contactar al dueño", "necesito un humano", "tengo una queja", "Un RECLAMO", "hablar con el encargado"])(
    "human: %s",
    (t) => expect(quickReplyKind(t)).toBe("human"),
  );

  // Decisión: "dueño" y "Luis" solos no derivan; hacen falta hablar/contactar/comunicar.
  it.each(["quiero un fade mañana con Luis", "¿el dueño atiende hoy?", "con el barbero de la barba"])("no es human: %s", (t) =>
    expect(quickReplyKind(t)).toBeNull(),
  );

  it.each(["hola", "Holaaa!", "buenas tardes", "Buenos días 👋", "oe mano", "qué tal", "hey", "¿Cómo estás?"])("greeting: %s", (t) =>
    expect(quickReplyKind(t)).toBe("greeting"),
  );

  it.each(["hola, quiero cita", "buenas, un fade", "hola 2"])("no es greeting: %s", (t) => expect(quickReplyKind(t)).not.toBe("greeting"));

  it.each(["👍", "???", "...", "", "k", "?a?"])("nonsense: %j", (t) => expect(quickReplyKind(t)).toBe("nonsense"));

  it.each(["1", "2", "ok", "sí", "fade"])("no es nonsense: %s", (t) => expect(quickReplyKind(t)).toBeNull());

  it("derivación con el número", () => {
    expect(humanHandoffText("51999111222")).toContain("+51999111222 (https://wa.me/51999111222)");
  });
});
