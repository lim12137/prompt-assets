import test from "node:test";
import assert from "node:assert/strict";

import config from "../../../playwright.config.ts";

test("playwright webServer 启动命令应先执行 prebuild-clean", () => {
  assert.ok(config.webServer);
  const command =
    typeof config.webServer === "object" ? config.webServer.command : "";
  const baseURL = typeof config.use?.baseURL === "string" ? config.use.baseURL : "";
  const matchedPort = baseURL.match(/:(\d+)$/);
  assert.ok(matchedPort, "baseURL 应包含端口");

  assert.equal(typeof command, "string");
  assert.ok(command.includes("prebuild-clean.mjs"));
  assert.ok(command.includes("prebuild-clean.mjs --target .next-e2e"));
  assert.ok(command.includes("run-next.mjs dev --dist .next-e2e"));
  if (typeof config.webServer === "object") {
    assert.equal(config.webServer.reuseExistingServer, false);
  }
});
