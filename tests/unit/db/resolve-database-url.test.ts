import test from "node:test";
import assert from "node:assert/strict";

import { resolveDatabaseUrl } from "../../../packages/db/src/resolve-database-url.ts";

test("DATABASE_URL 存在时应优先使用显式连接串", () => {
  assert.equal(
    resolveDatabaseUrl({
      DATABASE_URL: "postgres://custom:secret@db.internal:6543/custom_db",
      POSTGRES_DB: "ignored_db",
    }),
    "postgres://custom:secret@db.internal:6543/custom_db",
  );
});

test("缺失 DATABASE_URL 时应从 POSTGRES_* 组装连接串", () => {
  assert.equal(
    resolveDatabaseUrl({
      POSTGRES_HOST: "127.0.0.1",
      POSTGRES_PORT: "5432",
      POSTGRES_DB: "prompt_assets",
      POSTGRES_USER: "postgres",
      POSTGRES_PASSWORD: "postgres",
    }),
    "postgres://postgres:postgres@127.0.0.1:5432/prompt_assets",
  );
});

test("未提供任何数据库环境变量时应回退到历史默认值", () => {
  assert.equal(
    resolveDatabaseUrl({}),
    "postgres://postgres:postgres@127.0.0.1:5432/prompt_management",
  );
});
