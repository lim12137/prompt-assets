import test from "node:test";
import assert from "node:assert/strict";

import { parseAppEnv } from "../../../apps/web/lib/env.ts";

test("缺失 DATABASE_URL 时应抛出错误", () => {
  assert.throws(
    () =>
      parseAppEnv({
        APP_BASE_URL: "https://example.com",
      }),
    /DATABASE_URL/
  );
});

test("APP_BASE_URL 应可被正确解析", () => {
  const env = parseAppEnv({
    DATABASE_URL: "postgres://user:pass@localhost:5432/prompt_db",
    APP_BASE_URL: "https://example.com",
  });

  assert.equal(env.appBaseUrl.href, "https://example.com/");
});
