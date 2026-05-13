import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const remoteDefaults = {
  host: "10.45.131.70",
  port: "55432",
  user: "app_user",
  password: "ChangeMe_2026_Strong!",
  testUrl: "postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test",
  adminUrl: "postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db",
};

const runnerScripts = [
  "run-admin-real-db-e2e.mjs",
  "run-admin-create-import-real-db-e2e.mjs",
  "run-admin-category-management-real-db-e2e.mjs",
  "run-admin-prompts-management-real-db-e2e.mjs",
  "run-detail-real-db-e2e.mjs",
];

for (const scriptName of runnerScripts) {
  test(`${scriptName}: defaults to remote real-db env injection`, async () => {
    const scriptPath = path.resolve(__dirname, `../../../scripts/${scriptName}`);
    const script = await readFile(scriptPath, "utf-8");

    assert.ok(script.includes('const testDbMode = process.env.TEST_DB_MODE ?? explicitTestDbMode ?? "remote";'));
    assert.ok(script.includes(`"remote"`), "默认模式应偏向 remote");
    assert.ok(script.includes(`"${remoteDefaults.host}"`), "应包含远程测试库 host 默认值");
    assert.ok(script.includes(`"${remoteDefaults.port}"`), "应包含远程测试库 port 默认值");
    assert.ok(script.includes(`"${remoteDefaults.user}"`), "应包含远程测试库用户默认值");
    assert.ok(script.includes(`"${remoteDefaults.password}"`), "应包含远程测试库密码默认值");
    assert.ok(script.includes(`"${remoteDefaults.testUrl}"`), "应包含远程测试库连接串默认值");
    assert.ok(script.includes(`"${remoteDefaults.adminUrl}"`), "应包含远程管理库连接串默认值");
    assert.ok(script.includes("TEST_DB_HOST: testDbHost"), "应注入 TEST_DB_HOST");
    assert.ok(script.includes("TEST_DB_PORT: testDbPort"), "应注入 TEST_DB_PORT");
    assert.ok(script.includes("TEST_DB_USER: testDbUser"), "应注入 TEST_DB_USER");
    assert.ok(script.includes("TEST_DB_PASSWORD: testDbPassword"), "应注入 TEST_DB_PASSWORD");
    assert.ok(script.includes("TEST_DB_MODE: testDbMode"), "应注入 TEST_DB_MODE");
    assert.ok(script.includes("TEST_DB_ADMIN_URL: testDbAdminUrl"), "应注入 TEST_DB_ADMIN_URL");
    assert.ok(script.includes("TEST_DATABASE_URL: testDatabaseUrl"), "应注入 TEST_DATABASE_URL");
  });
}
