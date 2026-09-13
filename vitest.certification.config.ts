import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["certification/generated-app-certification.test.ts"],
    testTimeout: 360_000,
    hookTimeout: 30_000,
    sequence: {
      concurrent: false,
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
