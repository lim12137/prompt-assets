import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const scriptPath = path.resolve(__dirname, "../../../scripts/run-admin-real-db-e2e.mjs");

test("admin real-db runner uses tracked files owner-aware cleanup", async () => {
  const script = await readFile(scriptPath, "utf-8");

  assert.ok(
    script.includes('import { withTestDbLock } from "./with-test-db-lock.mjs";'),
    "应接入 withTestDbLock 全程加锁",
  );
  assert.ok(script.includes("await withTestDbLock(async () => {"), "应使用 withTestDbLock 包裹主流程");
  assert.ok(script.includes('const testDbPort = process.env.TEST_DB_PORT ?? "55436";'));
  assert.match(
    script,
    /const testDbContainer\s*=\s*process\.env\.TEST_DB_CONTAINER\s*\?\?\s*"prompt-management-test-db-admin";/,
  );
  assert.ok(script.includes("TEST_DB_PREPARE_SKIP_LOCK: \"1\""), "prepare 阶段应跳过内层锁");
  assert.ok(script.includes("TEST_DB_PORT: testDbPort"), "应透传独立端口到各步骤");
  assert.ok(script.includes("TEST_DB_CONTAINER: testDbContainer"), "应透传独立容器名到各步骤");
  assert.ok(script.includes("TEST_DATABASE_URL: testDatabaseUrl"), "应透传独立测试库连接串");
  assert.ok(script.includes("LOGIN_TOKEN_SECRET: loginTokenSecret"), "应显式透传 LOGIN_TOKEN_SECRET");
  assert.ok(script.includes("TRACKED_FILES_OWNER_TOKEN"), "应显式透传 tracked files owner token");
  assert.ok(script.includes("PLAYWRIGHT_WEB_PORT: playwrightWebPort"), "应透传独立 web 端口");
  assert.ok(script.includes("PLAYWRIGHT_WEB_DIST: playwrightWebDist"), "应透传独立构建目录");
  assert.ok(script.includes("cleanupTrackedFilesFromLock"), "runner 收尾应主动清理 tracked files");
  assert.ok(script.includes("expectedTrackedFilesOwnerToken"), "runner 清理 tracked files 时应校验 owner");
  assert.ok(script.includes(".next-tracked-files.lock"), "runner 应显式定位 tracked files 锁文件");
});
