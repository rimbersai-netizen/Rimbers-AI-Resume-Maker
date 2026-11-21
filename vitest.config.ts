import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "services/*/src/**/*.test.ts", "apps/web/src/**/*.test.ts", "tests/integration/**/*.test.ts", "scripts/src/**/*.test.ts"],
    environment: "node",
  },
});
