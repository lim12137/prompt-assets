import { spawnSync } from "node:child_process";

const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";

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
    ["exec", "playwright", "test", "tests/e2e/admin/management-real-db.spec.ts"],
    "执行 admin 真实 DB E2E",
    {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      PROMPT_REPOSITORY_DATA_SOURCE: "auto",
    },
  );
} finally {
  runStep(["db:test:down"], "清理测试数据库容器", process.env, true);
}
