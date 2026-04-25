import { spawnSync } from "node:child_process";
import { withTestDbLock } from "./with-test-db-lock.mjs";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";
const testSpecPath = "tests/e2e/admin/create-import-real-db.spec.ts";
const playwrightWebPort = process.env.PLAYWRIGHT_WEB_PORT ?? "3110";
const playwrightWebDist =
  process.env.PLAYWRIGHT_WEB_DIST ?? ".next-e2e-real-db-create-import";

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
      ...process.env,
      TEST_DB_PREPARE_SKIP_LOCK: "1",
    });
    runStep(
      ["exec", "playwright", "test", testSpecPath],
      `执行 admin 创建/导入真实 DB E2E (${testSpecPath})`,
      {
        ...process.env,
        DATABASE_URL: testDatabaseUrl,
        PROMPT_REPOSITORY_DATA_SOURCE: "auto",
        PLAYWRIGHT_WEB_PORT: playwrightWebPort,
        PLAYWRIGHT_WEB_DIST: playwrightWebDist,
      },
    );
  } finally {
    runStep(["db:test:down"], "清理测试数据库容器", process.env, true);
  }
});
