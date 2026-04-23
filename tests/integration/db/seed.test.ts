import test from "node:test";
import assert from "node:assert/strict";

import {
  isPgReachable,
  testDatabaseUrl,
  withPgClient,
} from "../../../packages/db/src/client.ts";
import { seedDatabase, seedPlan } from "../../../packages/db/src/seed.ts";
import {
  baseCategories,
  pendingSubmissionFixture,
  promptCatalog,
} from "../../fixtures/prompts.ts";

type SqlClient = {
  query: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
};

async function hasCoreSeedTables(client: SqlClient): Promise<boolean> {
  const result = await client.query<{ name: string }>(
    `
      SELECT unnest($1::text[]) AS name
      EXCEPT
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public';
    `,
    [["categories", "prompts", "prompt_versions", "submissions"]],
  );

  return result.rows.length === 0;
}

test("静态断言: 分类>=3 且包含内容创作/编程/设计", () => {
  assert.ok(baseCategories.length >= 3, "分类数量至少为 3");
  const names = new Set(baseCategories.map((item) => item.name));
  assert.equal(names.has("内容创作"), true, "缺少分类: 内容创作");
  assert.equal(names.has("编程"), true, "缺少分类: 编程");
  assert.equal(names.has("设计"), true, "缺少分类: 设计");
});

test("静态断言: prompts >= 10", () => {
  assert.ok(promptCatalog.length >= 10, "Prompt 总数至少为 10");
  assert.equal(seedPlan.prompts, promptCatalog.length);
});

test("静态断言: 至少 2 条 pending 数据", () => {
  assert.ok(
    pendingSubmissionFixture.length >= 2,
    "pendingSubmissionFixture 至少应有 2 条",
  );
  const pendingCount = pendingSubmissionFixture.filter(
    (item) => item.status === "pending",
  ).length;
  assert.ok(pendingCount >= 2, "pending 状态至少应有 2 条");
});

test("静态断言: 至少 1 个 prompt 具备多版本", () => {
  const multiVersionCount = promptCatalog.filter(
    (item) => item.versions.length >= 2,
  ).length;
  assert.ok(multiVersionCount >= 1, "至少应有 1 个多版本 Prompt");
  assert.ok(seedPlan.multiVersionPrompts >= 1);
});

test("真实DB断言: seed 后满足最小数据集规模", async (t) => {
  if (!(await isPgReachable(testDatabaseUrl))) {
    t.skip(`测试库不可达，跳过真实 DB 断言: ${testDatabaseUrl}`);
    return;
  }

  await withPgClient(testDatabaseUrl, async (client) => {
    if (!(await hasCoreSeedTables(client))) {
      t.skip("测试库可达但未完成迁移，跳过 seed 落库断言");
      return;
    }
  });

  await seedDatabase(testDatabaseUrl, { reset: true });

  await withPgClient(testDatabaseUrl, async (client) => {
    const categoriesCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM categories;`,
    );
    const promptsCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM prompts;`,
    );
    const pendingCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM submissions WHERE status = 'pending';`,
    );
    const multiVersionPromptCount = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM (
          SELECT prompt_id
          FROM prompt_versions
          GROUP BY prompt_id
          HAVING COUNT(*) >= 2
        ) t;
      `,
    );

    assert.ok(Number(categoriesCount.rows[0]?.count ?? "0") >= 3);
    assert.ok(Number(promptsCount.rows[0]?.count ?? "0") >= 10);
    assert.ok(Number(pendingCount.rows[0]?.count ?? "0") >= 2);
    assert.ok(Number(multiVersionPromptCount.rows[0]?.count ?? "0") >= 1);
  });
});
