import { expect, test, vi } from "vitest";
import type { AiAssistantPort } from "@/application/ports/assistant";
import { GroqAssistant } from "./groq-assistant";
import { aiAssistantEnabled, type AssistantDeps, selectAssistant } from "./select-assistant";

const basic: AiAssistantPort = { handleMessage: async () => ({ kind: "no-code" }) };
const deps: AssistantDeps = {
  fallback: basic,
  tools: { executeTool: async () => ({ ok: true, data: {} }) },
  conversations: { recent: async () => [], append: async () => {} },
  messaging: { sendText: async () => {}, sendTemplate: async () => {} },
  siteSettings: { get: async () => ({}) as never, save: async () => {} },
  services: { findAllActive: async () => [] } as never,
  barbers: { findAllActive: async () => [] } as never,
  now: () => new Date(),
};

test("sin AI_PROVIDER atiende el asistente básico", () => {
  expect(selectAssistant({}, deps)).toBe(basic);
});

test("con AI_PROVIDER=groq y su clave atiende el de IA", () => {
  expect(selectAssistant({ AI_PROVIDER: "groq", GROQ_API_KEY: "gsk_prueba" }, deps)).toBeInstanceOf(GroqAssistant);
});

test("sin clave, sin WhatsApp o con un proveedor desconocido avisa una vez y no rompe la web", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(selectAssistant({ AI_PROVIDER: "groq" }, deps)).toBe(basic);
  expect(selectAssistant({ AI_PROVIDER: "groq", GROQ_API_KEY: "gsk_prueba" }, { ...deps, messaging: null })).toBe(basic);
  expect(selectAssistant({ AI_PROVIDER: "otro", GROQ_API_KEY: "gsk_prueba" }, deps)).toBe(basic);
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});

test("aiAssistantEnabled pide proveedor groq y su clave", () => {
  expect(aiAssistantEnabled({ AI_PROVIDER: "groq", GROQ_API_KEY: "gsk_prueba" })).toBe(true);
  expect(aiAssistantEnabled({ AI_PROVIDER: "groq" })).toBe(false);
  expect(aiAssistantEnabled({ GROQ_API_KEY: "gsk_prueba" })).toBe(false);
  expect(aiAssistantEnabled({ AI_PROVIDER: "otro", GROQ_API_KEY: "gsk_prueba" })).toBe(false);
});
