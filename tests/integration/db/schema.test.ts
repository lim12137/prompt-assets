import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  isPgReachable,
  testDatabaseUrl,
  withPgClient,
} from "../../../packages/db/src/client.ts";
import {
  coreTableNames,
  coreUniqueConstraints,
} from "../../../packages/db/src/schema.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationSql = readFileSync(
  path.resolve(__dirname, "../../../packages/db/migrations/0001_init.sql"),
  "utf-8",
);

async function hasUniqueConstraint(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { exists: boolean }[] }> },
  table: string,
  columns: string[],
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ordinality) ON TRUE
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ck.attnum
        WHERE c.contype = 'u'
          AND n.nspname = 'public'
          AND t.relname = $1
        GROUP BY c.oid
        HAVING array_agg(a.attname ORDER BY ck.ordinality) = $2::text[]
      ) AS exists;
    `,
    [table, columns],
  );

  return result.rows[0]?.exists ?? false;
}

test("静态断言: 核心业务表已在迁移中定义", () => {
  for (const tableName of coreTableNames) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TABLE "${tableName}"`, "i"),
      `迁移缺少核心表: ${tableName}`,
    );
  }
});

test("静态断言: 关键唯一约束已在迁移中定义", () => {
  for (const unique of coreUniqueConstraints) {
    const columnsSql = unique.columns.map((column) => `"${column}"`).join(", ");
    assert.match(
      migrationSql,
      new RegExp(
        `CREATE UNIQUE INDEX "[^"]+" ON "${unique.table}" USING btree \\(${columnsSql}\\)`,
        "i",
      ),
      `迁移缺少唯一约束: ${unique.table}(${unique.columns.join(", ")})`,
    );
  }
});

test("静态断言: submission 仅承载审核关系，正文仅写在版本表", () => {
  assert.match(
    migrationSql,
    /CREATE TYPE "user_role" AS ENUM \('user', 'admin'\);/i,
    "角色枚举应至少包含 user/admin",
  );

  assert.match(
    migrationSql,
    /CREATE TABLE "prompt_versions"[\s\S]*"content" text NOT NULL/i,
    "prompt_versions 应包含正文 content",
  );

  const submissionsBlock = migrationSql.match(
    /CREATE TABLE "submissions"[\s\S]*?\);/i,
  )?.[0];
  assert.ok(submissionsBlock, "应存在 submissions 表定义");
  assert.equal(
    /"content"\s+text/i.test(submissionsBlock),
    false,
    "submissions 不应直接承载正文 content",
  );
});

test("真实DB断言: 核心业务表存在", async (t) => {
  if (!(await isPgReachable(testDatabaseUrl))) {
    t.skip(`测试库不可达，跳过真实 DB 断言: ${testDatabaseUrl}`);
    return;
  }

  await withPgClient(testDatabaseUrl, async (client) => {
    const result = await client.query<{ tablename: string }>(
      `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public';
      `,
    );

    const tableNames = new Set(result.rows.map((row) => row.tablename));

    for (const expectedTable of coreTableNames) {
      assert.equal(
        tableNames.has(expectedTable),
        true,
        `缺少表: ${expectedTable}`,
      );
    }
  });
});

test("真实DB断言: 关键唯一约束存在", async (t) => {
  if (!(await isPgReachable(testDatabaseUrl))) {
    t.skip(`测试库不可达，跳过真实 DB 断言: ${testDatabaseUrl}`);
    return;
  }

  await withPgClient(testDatabaseUrl, async (client) => {
    for (const unique of coreUniqueConstraints) {
      assert.equal(
        await hasUniqueConstraint(client, unique.table, unique.columns),
        true,
        `缺少唯一约束: ${unique.table}(${unique.columns.join(", ")})`,
      );
    }
  });
});
