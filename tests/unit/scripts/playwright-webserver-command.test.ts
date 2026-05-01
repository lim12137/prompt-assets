import test from "node:test";
import assert from "node:assert/strict";

import config from "../../../playwright.config.ts";

test("playwright webServer 启动命令应走统一 wrapper", () => {
  assert.ok(config.webServer);
  const command =
    typeof config.webServer === "object" ? config.webServer.command : "";
  const baseURL = typeof config.use?.baseURL === "string" ? config.use.baseURL : "";
  const matchedPort = baseURL.match(/:(\d+)$/);
  assert.ok(matchedPort, "baseURL 应包含端口");

  assert.equal(typeof command, "string");
  assert.ok(command.includes("run-playwright-webserver.mjs"));
  assert.ok(command.includes("--dist .next-e2e"));
  assert.ok(command.includes("--hostname 127.0.0.1"));
  assert.equal(config.globalSetup, "./tests/e2e/global-setup.ts");
  assert.equal(config.globalTeardown, "./tests/e2e/global-teardown.ts");
  if (typeof config.webServer === "object") {
    assert.equal(config.webServer.reuseExistingServer, false);
  }
});
