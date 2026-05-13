import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveDatabaseProbeTarget,
  resolveTestDbMode,
  shouldRunDockerCleanup,
} from "../../../scripts/test-db-env.mjs";

test("resolveTestDbMode: 显式远程连接串进入 remote 模式", () => {
  assert.equal(
    resolveTestDbMode({
      TEST_DATABASE_URL:
        "postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test",
    }),
    "remote",
  );
});

test("resolveTestDbMode: 本地默认配置保持 docker 模式", () => {
  assert.equal(resolveTestDbMode({}), "docker");
  assert.equal(
    resolveTestDbMode({
      TEST_DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test",
    }),
    "docker",
  );
});

test("resolveDatabaseProbeTarget: 从 TEST_DATABASE_URL 解析探测地址", () => {
  assert.deepEqual(
    resolveDatabaseProbeTarget({
      TEST_DATABASE_URL:
        "postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test",
    }),
    {
      host: "10.45.131.70",
      port: 55432,
    },
  );
});

test("shouldRunDockerCleanup: 远程模式跳过 Docker 清理", () => {
  assert.equal(
    shouldRunDockerCleanup({
      TEST_DATABASE_URL:
        "postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test",
    }),
    false,
  );
  assert.equal(shouldRunDockerCleanup({}), true);
});
