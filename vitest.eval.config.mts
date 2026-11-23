import { defineConfig } from "vitest/config";

// Batería contra el modelo real (`npm run test:ia`): en serie, con tiempo de sobra por caso.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["src/**/*.eval.ts"],
    fileParallelism: false,
    testTimeout: 90_000,
    hookTimeout: 30_000,
  },
});
