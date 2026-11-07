import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Lógica que se prueba aquí; páginas y componentes los recorre Playwright en e2e/.
      include: ["src/core/**/*.ts", "src/application/**/*.ts", "src/infrastructure/**/*.ts", "src/presentation/lib/**/*.ts", "src/app/**/*.ts"],
      exclude: ["**/*.test.ts", "src/infrastructure/db/client.ts", "src/infrastructure/container.ts", "src/app/panel/session.ts"],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 },
    },
  },
});
