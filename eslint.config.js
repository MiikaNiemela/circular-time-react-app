import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import prettierConfig from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";

export default tseslint.config(
  // Base JS recommended rules
  js.configs.recommended,
  // TypeScript rules
  ...tseslint.configs.recommended,
  // React and hooks rules
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      // React 17+ JSX transform — no need to import React in scope.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
    settings: {
      react: { version: "detect" },
    },
  },
  // Disable formatting rules that clash with Prettier
  prettierConfig,
  // Project-specific overrides
  {
    rules: {
      // Allow unused vars prefixed with _ (common for destructuring).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  // JSDoc enforcement on the business-logic layer's public API.
  // Scope is narrow: exported functions and interfaces in app/lib/ only.
  // @param/@returns are intentionally NOT required — TypeScript covers the shape;
  // @param is added only when the argument's meaning needs prose clarification.
  {
    files: ["app/lib/**/*.ts"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": ["error", {
        publicOnly: true,
        require: {
          FunctionDeclaration: true,
          FunctionExpression: false,
          ArrowFunctionExpression: false,
          ClassDeclaration: false,
        },
        contexts: ["TSInterfaceDeclaration"],
      }],
      "jsdoc/require-description": "error",
      "jsdoc/check-param-names": "error",
      "jsdoc/check-tag-names": ["error", { typed: true }],
    },
  },
  // Files to ignore
  {
    ignores: ["build/**", "node_modules/**", ".react-router/**"],
  }
);
