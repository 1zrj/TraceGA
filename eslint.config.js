import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    ignores: ["node_modules", "packages/*/node_modules"],
  },
  {
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
    },
  },
  prettierConfig,
];
