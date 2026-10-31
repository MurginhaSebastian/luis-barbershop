import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Clean Architecture: las dependencias solo apuntan hacia dentro.
  {
    files: ["src/core/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/application/**", "**/infrastructure/**", "**/presentation/**", "**/app/**",
            "next", "next/*", "react", "react/*", "react-dom", "react-dom/*", "zod", "zod/*"],
          message: "core/ es TypeScript puro: no depende de otras capas ni de librerías.",
        }],
      }],
    },
  },
  {
    files: ["src/application/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/infrastructure/**", "**/presentation/**", "**/app/**",
            "next", "next/*", "react", "react/*", "react-dom", "react-dom/*"],
          message: "application/ solo depende de core/ y de sus propios puertos.",
        }],
      }],
    },
  },
  {
    files: ["src/presentation/**"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [{
          group: ["**/infrastructure/**", "**/app/**"],
          message: "presentation/ recibe datos y acciones por props; no monta casos de uso.",
        }],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
