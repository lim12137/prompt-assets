import { defineConfig } from "@playwright/test";

const host = process.env.PLAYWRIGHT_WEB_HOST ?? "127.0.0.1";
const fallbackPort = 32000 + Math.floor(Math.random() * 10_000);
const selectedPort = process.env.PLAYWRIGHT_WEB_PORT ?? String(fallbackPort);
if (!process.env.PLAYWRIGHT_WEB_PORT) {
  process.env.PLAYWRIGHT_WEB_PORT = selectedPort;
}
const port = Number(selectedPort);
const distDir = process.env.PLAYWRIGHT_WEB_DIST ?? ".next-e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: `http://${host}:${port}`,
  },
  webServer: {
    command:
      `pnpm --filter @prompt-management/web exec node ./scripts/run-playwright-webserver.mjs --dist ${distDir} --hostname ${host} --port ${port}`,
    port,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
