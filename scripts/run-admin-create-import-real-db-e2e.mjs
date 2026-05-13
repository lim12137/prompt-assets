import { spawnSync } from "node:child_process";
import { withTestDbLock } from "./with-test-db-lock.mjs";
import { shouldRunDockerCleanup } from "./test-db-env.mjs";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const explicitTestDbMode = process.env.TEST_DB_MODE ?? process.env.TEST_DB_PREPARE_MODE;
const useDockerDefaults = explicitTestDbMode === "docker";
const testDbMode = process.env.TEST_DB_MODE ?? explicitTestDbMode ?? "remote";
const testDbHost = process.env.TEST_DB_HOST ?? (useDockerDefaults ? "127.0.0.1" : "10.45.131.70");
const testDbPort = process.env.TEST_DB_PORT ?? (useDockerDefaults ? "55432" : "55432");
const testDbUser = process.env.TEST_DB_USER ?? (useDockerDefaults ? "postgres" : "app_user");
const testDbPassword =
  process.env.TEST_DB_PASSWORD ?? (useDockerDefaults ? "postgres" : "ChangeMe_2026_Strong!");
const testDbContainer = process.env.TEST_DB_CONTAINER ?? "prompt-management-test-db";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  (useDockerDefaults
    ? `postgres://${encodeURIComponent(testDbUser)}:${encodeURIComponent(testDbPassword)}@${testDbHost}:${testDbPort}/prompt_management_test`
    : "postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test");
const testDbAdminUrl =
  process.env.TEST_DB_ADMIN_URL ??
  (useDockerDefaults
    ? `postgres://${encodeURIComponent(testDbUser)}:${encodeURIComponent(testDbPassword)}@${testDbHost}:${testDbPort}/postgres`
    : "postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db");
const testSpecPath = "tests/e2e/admin/create-import-real-db.spec.ts";
const playwrightWebPort = process.env.PLAYWRIGHT_WEB_PORT ?? "3110";
const playwrightWebDist =
  process.env.PLAYWRIGHT_WEB_DIST ?? ".next-e2e-real-db-create-import";
const testDbEnv = {
  ...process.env,
  TEST_DB_HOST: testDbHost,
  TEST_DB_PORT: testDbPort,
  TEST_DB_USER: testDbUser,
  TEST_DB_PASSWORD: testDbPassword,
  TEST_DB_MODE: testDbMode,
  TEST_DB_CONTAINER: testDbContainer,
  TEST_DB_ADMIN_URL: testDbAdminUrl,
  TEST_DATABASE_URL: testDatabaseUrl,
};

function runStep(args, label, env = process.env, allowFailure = false) {
  console.log(`==> ${label}`);
  const result = spawnSync(pnpmCommand, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });

  if (result.error && !allowFailure) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}`);
  }
}

await withTestDbLock(async () => {
  try {
    runStep(["db:test:prepare"], "准备真实测试数据库", {
      ...testDbEnv,
      TEST_DB_PREPARE_SKIP_LOCK: "1",
    });
    runStep(
      ["exec", "playwright", "test", testSpecPath],
      `执行 admin 创建/导入真实 DB E2E (${testSpecPath})`,
      {
        ...testDbEnv,
        DATABASE_URL: testDatabaseUrl,
        PROMPT_REPOSITORY_DATA_SOURCE: "auto",
        PLAYWRIGHT_WEB_PORT: playwrightWebPort,
        PLAYWRIGHT_WEB_DIST: playwrightWebDist,
      },
    );
  } finally {
    if (shouldRunDockerCleanup(testDbEnv)) {
      runStep(["db:test:down"], "清理测试数据库容器", testDbEnv, true);
    }
  }
});
