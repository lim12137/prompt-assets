import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:3010",
  },
  webServer: {
    command:
      "pnpm --filter @prompt-management/web dev --hostname 127.0.0.1 --port 3010",
    port: 3010,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
