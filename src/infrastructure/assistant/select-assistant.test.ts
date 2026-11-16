import { expect, test, vi } from "vitest";
import type { AiAssistantPort } from "@/application/ports/assistant";
import { selectAssistant } from "./select-assistant";

const basic: AiAssistantPort = { handleMessage: async () => ({ kind: "no-code" }) };

test("sin AI_PROVIDER atiende el asistente básico", () => {
  expect(selectAssistant({}, basic)).toBe(basic);
});

test("un AI_PROVIDER sin adaptador avisa una vez y no rompe la web", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(selectAssistant({ AI_PROVIDER: "groq" }, basic)).toBe(basic);
  expect(selectAssistant({ AI_PROVIDER: "groq" }, basic)).toBe(basic);
  expect(warn).toHaveBeenCalledTimes(1);
  warn.mockRestore();
});
