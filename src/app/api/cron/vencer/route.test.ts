import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { GET } from "./route";

const expireOverdue = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/container", () => ({ getUseCases: () => ({ bookingConfirmation: { expireOverdue } }) }));

const call = (authorization?: string) =>
  GET(new Request("https://barberia.example/api/cron/vencer", { headers: authorization ? { authorization } : {} }));

beforeEach(() => {
  vi.stubEnv("CRON_SECRET", "secreto-del-cron");
  expireOverdue.mockReset().mockResolvedValue({ expired: 2, failed: 0 });
});
afterEach(() => vi.unstubAllEnvs());

test("con el secreto vence las citas y dice cuántas", async () => {
  const response = await call("Bearer secreto-del-cron");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ expired: 2, failed: 0 });
});

test.each([
  ["sin cabecera", undefined],
  ["con otro secreto", "Bearer otro"],
  ["sin el prefijo", "secreto-del-cron"],
])("%s no hace nada", async (_, header) => {
  expect((await call(header)).status).toBe(401);
  expect(expireOverdue).not.toHaveBeenCalled();
});

test("sin CRON_SECRET configurado no lo puede llamar nadie", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await call("Bearer ")).status).toBe(401);
  expect(expireOverdue).not.toHaveBeenCalled();
});
