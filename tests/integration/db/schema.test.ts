import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
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
const migrationsDir = path.resolve(__dirname, "../../../packages/db/migrations");
const migrationSql = readdirSync(migrationsDir)
  .filter((fileName) => fileName.endsWith(".sql"))
  .sort()
  .map((fileName) => readFileSync(path.join(migrationsDir, fileName), "utf-8"))
  .join("\n\n");

async function hasUniqueConstraint(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { exists: boolean }[] }> },
  table: string,
  columns: string[],
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_index i
        JOIN pg_class t ON t.oid = i.indrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN unnest(i.indkey) WITH ORDINALITY AS ik(attnum, ordinality) ON TRUE
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ik.attnum
        WHERE i.indisunique = TRUE
          AND n.nspname = 'public'
          AND t.relname = $1
        GROUP BY i.indexrelid
        HAVING array_agg(a.attname::text ORDER BY ik.ordinality) = $2::text[]
      ) AS exists;
    `,
    [table, columns],
  );

  return result.rows[0]?.exists ?? false;
}

async function hasCheckConstraint(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: { exists: boolean }[] }> },
  table: string,
  expressionPattern: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM pg_constraint c
        INNER JOIN pg_class t ON t.oid = c.conrelid
        INNER JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE c.contype = 'c'
          AND n.nspname = 'public'
          AND t.relname = $1
          AND pg_get_constraintdef(c.oid) ~* $2
      ) AS exists;
    `,
    [table, expressionPattern],
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
        `CREATE UNIQUE INDEX "[^"]+"\\s+ON "${unique.table}"\\s+USING btree\\s*\\(${columnsSql}\\)`,
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

test("静态断言: 多分类关系表与系统分类字段已在迁移中定义", () => {
  assert.match(
    migrationSql,
    /CREATE TABLE "prompt_categories"[\s\S]*"prompt_id"\s+integer\s+NOT NULL[\s\S]*"category_id"\s+integer\s+NOT NULL/i,
    "迁移缺少 prompt_categories 关系表",
  );

  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "prompt_categories_prompt_id_category_id_key"\s+ON "prompt_categories"\s+USING btree\s*\("prompt_id", "category_id"\)/i,
    "迁移缺少 prompt_categories(prompt_id, category_id) 唯一约束",
  );

  assert.match(
    migrationSql,
    /CREATE INDEX "prompt_categories_category_id_prompt_id_idx"\s+ON "prompt_categories"\s+USING btree\s*\("category_id", "prompt_id"\)/i,
    "迁移缺少 prompt_categories(category_id, prompt_id) 索引",
  );

  assert.match(
    migrationSql,
    /ALTER TABLE "categories"[\s\S]*ADD COLUMN[\s\S]*"is_system"\s+boolean[\s\S]*ADD COLUMN[\s\S]*"is_selectable"\s+boolean[\s\S]*ADD COLUMN[\s\S]*"is_collapsed_by_default"\s+boolean/i,
    "迁移缺少 categories 系统字段",
  );

  assert.match(
    migrationSql,
    /INSERT INTO "categories"[\s\S]*"slug"[\s\S]*'uncategorized'[\s\S]*ON CONFLICT \("slug"\)/i,
    "迁移缺少 uncategorized 基线数据",
  );

  assert.match(
    migrationSql,
    /INSERT INTO "prompt_categories"[\s\S]*SELECT[\s\S]*FROM "prompts"/i,
    "迁移缺少 prompts.category_id 到 prompt_categories 的历史回填",
  );
});

test("静态断言: 版本级点赞表、唯一约束与版本计数字段已在迁移中定义", () => {
  assert.match(
    migrationSql,
    /CREATE TABLE "prompt_version_likes"[\s\S]*"prompt_version_id"\s+integer\s+NOT NULL[\s\S]*"user_id"\s+integer\s+NOT NULL/i,
    "迁移缺少 prompt_version_likes 表",
  );

  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "prompt_version_likes_prompt_version_id_user_id_key"\s+ON "prompt_version_likes"\s+USING btree\s*\("prompt_version_id", "user_id"\)/i,
    "迁移缺少 prompt_version_likes(prompt_version_id, user_id) 唯一约束",
  );

  assert.match(
    migrationSql,
    /CREATE TABLE "prompt_versions"[\s\S]*"likes_count"\s+integer\s+DEFAULT 0\s+NOT NULL/i,
    "迁移缺少 prompt_versions.likes_count 字段",
  );
});

test("静态断言: 版本级评分表与 score 1-5 约束已在迁移中定义", () => {
  assert.match(
    migrationSql,
    /CREATE TABLE "prompt_version_scores"[\s\S]*"prompt_version_id"\s+integer\s+NOT NULL[\s\S]*"scene"\s+text\s+NOT NULL[\s\S]*"trace_id"\s+text\s+NOT NULL[\s\S]*"score"\s+integer\s+NOT NULL/i,
    "迁移缺少 prompt_version_scores 表及核心字段",
  );

  assert.match(
    migrationSql,
    /CREATE UNIQUE INDEX "prompt_version_scores_prompt_version_id_scene_trace_id_key"\s+ON "prompt_version_scores"\s+USING btree\s*\("prompt_version_id", "scene", "trace_id"\)/i,
    "迁移缺少 prompt_version_scores(prompt_version_id, scene, trace_id) 唯一约束",
  );

  assert.match(
    migrationSql,
    /CONSTRAINT "prompt_version_scores_score_range_check"\s+CHECK\s*\("score"\s+BETWEEN\s+1\s+AND\s+5\)/i,
    "迁移缺少 score 1-5 检查约束",
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

test("真实DB断言: 分类系统字段与多分类关系表可用", async (t) => {
  if (!(await isPgReachable(testDatabaseUrl))) {
    t.skip(`测试库不可达，跳过真实 DB 断言: ${testDatabaseUrl}`);
    return;
  }

  await withPgClient(testDatabaseUrl, async (client) => {
    const tableResult = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename = 'prompt_categories'
        ) AS exists;
      `,
    );
    assert.equal(tableResult.rows[0]?.exists, true, "缺少表: prompt_categories");

    const columnResult = await client.query<{ column_name: string }>(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'categories'
          AND column_name = ANY($1::text[])
        ORDER BY column_name ASC;
      `,
      [["is_collapsed_by_default", "is_selectable", "is_system"]],
    );
    const columns = new Set(columnResult.rows.map((row) => row.column_name));
    assert.equal(columns.has("is_system"), true, "缺少字段: categories.is_system");
    assert.equal(
      columns.has("is_selectable"),
      true,
      "缺少字段: categories.is_selectable",
    );
    assert.equal(
      columns.has("is_collapsed_by_default"),
      true,
      "缺少字段: categories.is_collapsed_by_default",
    );
  });
});

test("真实DB断言: 版本级点赞表、唯一约束与版本计数字段可用", async (t) => {
  if (!(await isPgReachable(testDatabaseUrl))) {
    t.skip(`测试库不可达，跳过真实 DB 断言: ${testDatabaseUrl}`);
    return;
  }

  await withPgClient(testDatabaseUrl, async (client) => {
    const tableResult = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename = 'prompt_version_likes'
        ) AS exists;
      `,
    );
    assert.equal(
      tableResult.rows[0]?.exists,
      true,
      "缺少表: prompt_version_likes",
    );

    assert.equal(
      await hasUniqueConstraint(
        client,
        "prompt_version_likes",
        ["prompt_version_id", "user_id"],
      ),
      true,
      "缺少唯一约束: prompt_version_likes(prompt_version_id, user_id)",
    );

    const columnResult = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'prompt_versions'
            AND column_name = 'likes_count'
        ) AS exists;
      `,
    );
    assert.equal(
      columnResult.rows[0]?.exists,
      true,
      "缺少字段: prompt_versions.likes_count",
    );
  });
});

test("真实DB断言: 版本级评分表与 score 1-5 约束可用", async (t) => {
  if (!(await isPgReachable(testDatabaseUrl))) {
    t.skip(`测试库不可达，跳过真实 DB 断言: ${testDatabaseUrl}`);
    return;
  }

  await withPgClient(testDatabaseUrl, async (client) => {
    const tableResult = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM pg_tables
          WHERE schemaname = 'public' AND tablename = 'prompt_version_scores'
        ) AS exists;
      `,
    );
    assert.equal(
      tableResult.rows[0]?.exists,
      true,
      "缺少表: prompt_version_scores",
    );

    assert.equal(
      await hasUniqueConstraint(
        client,
        "prompt_version_scores",
        ["prompt_version_id", "scene", "trace_id"],
      ),
      true,
      "缺少唯一约束: prompt_version_scores(prompt_version_id, scene, trace_id)",
    );

    assert.equal(
      await hasCheckConstraint(
        client,
        "prompt_version_scores",
        "score.*BETWEEN 1 AND 5",
      ),
      true,
      "缺少检查约束: score BETWEEN 1 AND 5",
    );
  });
});
