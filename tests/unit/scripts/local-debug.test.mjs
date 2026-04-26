import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  buildDatabaseUrl,
  buildExecutionPlan,
  buildWebDevArgs,
  resolveLocalDebugConfig,
} from "../../../scripts/local-debug.mjs";

test("resolveLocalDebugConfig returns local debug defaults", () => {
  const config = resolveLocalDebugConfig({});

  assert.equal(config.composeFile.endsWith("docker-compose.local-debug.yml"), true);
  assert.equal(config.databaseHost, "127.0.0.1");
  assert.equal(config.databasePort, "55432");
  assert.equal(config.databaseName, "prompt_management");
  assert.equal(config.databaseUser, "postgres");
  assert.equal(config.databasePassword, "postgres");
  assert.equal(config.appBaseUrl, "http://127.0.0.1:13000");
  assert.equal(config.webHost, "127.0.0.1");
  assert.equal(config.webPort, "13000");
});

test("buildDatabaseUrl prefers resolved config values", () => {
  const config = resolveLocalDebugConfig({
    LOCAL_POSTGRES_HOST: "localhost",
    LOCAL_POSTGRES_PORT: "6543",
    LOCAL_POSTGRES_DB: "prompt_assets_dev",
    LOCAL_POSTGRES_USER: "devuser",
    LOCAL_POSTGRES_PASSWORD: "devpass",
  });

  assert.equal(
    buildDatabaseUrl(config),
    "postgres://devuser:devpass@localhost:6543/prompt_assets_dev",
  );
});

test("buildExecutionPlan keeps dev mode persistent and restart friendly", () => {
  assert.deepEqual(buildExecutionPlan("dev"), ["db-up", "db-migrate", "db-seed", "web"]);
  assert.deepEqual(buildExecutionPlan("prepare"), ["db-up", "db-migrate", "db-seed"]);
  assert.deepEqual(buildExecutionPlan("restart-web"), ["stop-web", "web"]);
});

test("buildWebDevArgs starts only the local web service with resolved host and port", () => {
  const config = resolveLocalDebugConfig({
    LOCAL_WEB_HOST: "0.0.0.0",
    LOCAL_WEB_PORT: "14000",
  });

  assert.deepEqual(buildWebDevArgs(config), [
    "--filter",
    "@prompt-management/web",
    "dev",
    "--hostname",
    "0.0.0.0",
    "--port",
    "14000",
  ]);
});

test("local-debug.bat maps Windows shortcuts to local debug actions", async () => {
  const bat = await readFile(path.resolve("local-debug.bat"), "utf-8");

  assert.match(bat, /node\s+"%SCRIPT%"\s+prepare/i);
  assert.match(bat, /node\s+"%SCRIPT%"\s+db-up/i);
  assert.match(bat, /node\s+"%SCRIPT%"\s+web/i);
  assert.match(bat, /node\s+"%SCRIPT%"\s+restart-web/i);
  assert.match(bat, /node\s+"%SCRIPT%"\s+stop-web/i);
  assert.match(bat, /node\s+"%SCRIPT%"\s+db-down/i);
  assert.match(bat, /node\s+"%SCRIPT%"\s+db-status/i);
  assert.match(bat, /node\s+"%SCRIPT%"\s+db-logs/i);
});

test(
  "local-debug.bat uses safe defaults for empty action and unknown action",
  { skip: process.platform !== "win32" },
  () => {
    const runBat = (rawArgs) =>
      spawnSync("cmd.exe", ["/d", "/s", "/c", `local-debug.bat ${rawArgs}`], {
        cwd: path.resolve("."),
        encoding: "utf-8",
      });

    const noArgs = runBat("");
    assert.equal(noArgs.status, 0);
    assert.match(noArgs.stdout, /Usage:\s+local-debug\.bat/i);
    assert.match(noArgs.stdout, /prepare/i);
    assert.match(noArgs.stdout, /status/i);
    assert.match(noArgs.stdout, /logs/i);

    const unknown = runBat("unknown-action");
    assert.equal(unknown.status, 1);
    assert.match(unknown.stdout, /Unknown action:\s+unknown-action/i);
    assert.match(unknown.stdout, /Usage:\s+local-debug\.bat/i);
  },
);
