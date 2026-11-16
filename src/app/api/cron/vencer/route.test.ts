import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const run = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/container", () => ({ getUseCases: () => ({ confirmationCycle: { run } }) }));

const call = (authorization?: string) =>
  GET(new Request("https://barberia.example/api/cron/vencer", { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "secreto-del-cron");
  run.mockReset().mockResolvedValue({ reminded: 1, atRisk: 1, expired: 2, failed: 0 });
});
afterEach(() => vi.unstubAllEnvs());

test("con el secreto corre el ciclo y dice qué hizo", async () => {
  const response = await call("Bearer secreto-del-cron");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ reminded: 1, atRisk: 1, expired: 2, failed: 0 });
});

test.each([
  ["sin cabecera", undefined],
  ["con otro secreto", "Bearer otro"],
  ["sin el prefijo", "secreto-del-cron"],
])("%s no hace nada", async (_, header) => {
  expect((await call(header)).status).toBe(401);
  expect(run).not.toHaveBeenCalled();
});

test("sin CRON_SECRET configurado no lo puede llamar nadie", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await call("Bearer ")).status).toBe(401);
  expect(run).not.toHaveBeenCalled();
});
