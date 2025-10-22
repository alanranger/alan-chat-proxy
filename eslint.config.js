// eslint.config.js — ESLint 9 flat config for JS + CJS (with test & tools overrides)
import js from "@eslint/js";
import sonarjs from "eslint-plugin-sonarjs";

export default [
  js.configs.recommended,

  // --- Main JS/ESM files ---
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        // Node globals
        process: "readonly",
        __dirname: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        Buffer: "readonly",

        // Browser/URL globals
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        location: "readonly",
        fetch: "readonly",
        Request: "readonly",
        Response: "readonly",
        Headers: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",

        // Console and timers
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly"
      }
    },
    plugins: { sonarjs },
    rules: {
      // Strict for app code
      complexity: ["error", 8],
      "sonarjs/cognitive-complexity": ["error", 8],
      "max-statements": ["error", 15],
      "max-params": ["error", 3],
      "max-depth": ["error", 3],
      "max-lines-per-function": [
        "error",
        { max: 60, skipBlankLines: true, skipComments: true }
      ]
    }
  },

  // --- CommonJS files (.cjs) ---
  {
    files: ["**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        process: "readonly",
        module: "readonly",
        require: "readonly",
        __dirname: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly"
      }
    }
  },

  // --- Tests: relaxed rules so app code stays strict ---
  {
    files: ["**/test-*.{js,cjs}", "**/*-test.{js,cjs}", "**/tests/**/*.{js,cjs}"],
    plugins: { sonarjs },
    rules: {
      "complexity": ["warn", 12],
      "sonarjs/cognitive-complexity": ["warn", 12],
      "max-statements": ["warn", 30],
      "max-lines-per-function": ["warn", { max: 150, skipBlankLines: true, skipComments: true }],
      "max-params": ["warn", 6],
      "max-depth": ["warn", 5],
      "no-unused-vars": ["warn", { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" }],
      "no-empty": "warn"
    }
  },

  // --- Optional: tools/ scripts (slightly relaxed). Remove if you want strict.
  {
    files: ["tools/**/*.{js,cjs}"],
    rules: {
      "complexity": ["warn", 12],
      "max-statements": ["warn", 30],
      "max-lines-per-function": ["warn", { max: 120, skipBlankLines: true, skipComments: true }]
    }
  },

  // --- Ignore heavy/generated paths ---
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      ".next/**",
      "generated/**"
    ]
  }
];
