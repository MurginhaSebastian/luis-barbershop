import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Accesibilidad completa: Next registra el plugin jsx-a11y pero solo activa unas pocas reglas.
  { files: ["**/*.tsx"], rules: jsxA11y.flatConfigs.recommended.rules },
  // Con tipos: promesas olvidadas o mal usadas (una Server Action sin await falla en silencio).
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
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
    "coverage/**",
  ]),
]);

export default eslintConfig;
