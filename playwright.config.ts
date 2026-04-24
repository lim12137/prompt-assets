import { defineConfig } from "@playwright/test";

const host = process.env.PLAYWRIGHT_WEB_HOST ?? "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_WEB_PORT ?? "3010");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: `http://${host}:${port}`,
  },
  webServer: {
    command:
      `pnpm --filter @prompt-management/web dev --hostname ${host} --port ${port}`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
