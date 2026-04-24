import { spawnSync } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";
const testSpecPath =
  process.env.DETAIL_E2E_SPEC_PATH ??
  "tests/e2e/smoke/prompt-detail-real-db.spec.ts";

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

try {
  runStep(["db:test:prepare"], "准备真实测试数据库");
  runStep(
    ["exec", "playwright", "test", testSpecPath],
    `执行详情真实 DB E2E (${testSpecPath})`,
    {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      PROMPT_REPOSITORY_DATA_SOURCE: "auto",
    },
  );
} finally {
  runStep(["db:test:down"], "清理测试数据库容器", process.env, true);
}
