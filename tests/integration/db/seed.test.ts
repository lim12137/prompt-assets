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
    [["categories", "prompts", "prompt_versions", "submissions", "prompt_categories"]],
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

test("静态断言: seed 计划包含系统待分类 uncategorized", () => {
  assert.ok(
    seedPlan.categories >= baseCategories.length + 1,
    "seedPlan.categories 应包含系统待分类 uncategorized",
  );
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

test("真实DB断言: seed 会写入唯一 uncategorized 系统分类", async (t) => {
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
    const result = await client.query<{
      count: string;
      is_system: boolean;
      is_selectable: boolean;
      is_collapsed_by_default: boolean;
    }>(
      `
        SELECT
          COUNT(*)::text AS count,
          BOOL_OR(is_system) AS is_system,
          BOOL_OR(is_selectable) AS is_selectable,
          BOOL_OR(is_collapsed_by_default) AS is_collapsed_by_default
        FROM categories
        WHERE slug = 'uncategorized';
      `,
    );

    assert.equal(Number(result.rows[0]?.count ?? "0"), 1, "uncategorized 应唯一");
    assert.equal(result.rows[0]?.is_system, true, "uncategorized 必须是系统分类");
    assert.equal(
      result.rows[0]?.is_selectable,
      false,
      "uncategorized 不应可被手动选择",
    );
    assert.equal(
      result.rows[0]?.is_collapsed_by_default,
      true,
      "uncategorized 应默认折叠",
    );
  });
});

test("真实DB断言: 已发布 prompt 至少有一条分类关系", async (t) => {
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
    const promptCountResult = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM prompts WHERE status = 'published';`,
    );
    const mappedCountResult = await client.query<{ count: string }>(
      `
        SELECT COUNT(DISTINCT pc.prompt_id)::text AS count
        FROM prompt_categories pc
        INNER JOIN prompts p ON p.id = pc.prompt_id
        WHERE p.status = 'published';
      `,
    );

    assert.equal(
      Number(mappedCountResult.rows[0]?.count ?? "0"),
      Number(promptCountResult.rows[0]?.count ?? "0"),
      "每个 published prompt 都应至少有 1 条 prompt_categories 关系",
    );
  });
});

test("真实DB断言: 零分类 prompt 会在补偿阶段归入 uncategorized", async (t) => {
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

  const orphanSlug = `orphan-${Date.now()}`;
  await withPgClient(testDatabaseUrl, async (client) => {
    const categoryResult = await client.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'programming' LIMIT 1;`,
    );
    const legacyCategoryId = Number(categoryResult.rows[0]?.id ?? 0);
    assert.ok(legacyCategoryId > 0, "应存在 programming 分类");

    await client.query(
      `
        INSERT INTO prompts (slug, title, summary, category_id, status)
        VALUES ($1, $2, $3, $4, 'published');
      `,
      [orphanSlug, "Orphan Prompt", "orphan summary", legacyCategoryId],
    );
  });

  await seedDatabase(testDatabaseUrl, { reset: false });

  await withPgClient(testDatabaseUrl, async (client) => {
    const result = await client.query<{ slug: string }>(
      `
        SELECT c.slug
        FROM prompts p
        INNER JOIN prompt_categories pc ON pc.prompt_id = p.id
        INNER JOIN categories c ON c.id = pc.category_id
        WHERE p.slug = $1
        ORDER BY c.slug ASC;
      `,
      [orphanSlug],
    );

    assert.ok(result.rows.length >= 1, "零分类 prompt 应被自动补挂分类");
    assert.equal(
      result.rows.some((row) => row.slug === "uncategorized"),
      true,
      "零分类 prompt 应自动归入 uncategorized",
    );
  });
});

test("真实DB断言: 删除分类后关系表保持一致（可测部分）", async (t) => {
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

  const transientSlug = `temp-delete-${Date.now()}`;
  await withPgClient(testDatabaseUrl, async (client) => {
    const promptResult = await client.query<{ id: number }>(
      `SELECT id FROM prompts WHERE status = 'published' ORDER BY id ASC LIMIT 1;`,
    );
    const promptId = Number(promptResult.rows[0]?.id ?? 0);
    assert.ok(promptId > 0, "应至少存在一个 published prompt");

    const categoryResult = await client.query<{ id: number }>(
      `
        INSERT INTO categories (name, slug, sort_order, status)
        VALUES ($1, $2, 9999, 'active')
        RETURNING id;
      `,
      ["临时删除验证分类", transientSlug],
    );
    const categoryId = Number(categoryResult.rows[0]?.id ?? 0);
    assert.ok(categoryId > 0, "临时分类写入失败");

    await client.query(
      `
        INSERT INTO prompt_categories (prompt_id, category_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_id, category_id) DO NOTHING;
      `,
      [promptId, categoryId],
    );

    const beforeDelete = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM prompt_categories
        WHERE prompt_id = $1 AND category_id = $2;
      `,
      [promptId, categoryId],
    );
    assert.equal(Number(beforeDelete.rows[0]?.count ?? "0"), 1);

    await client.query(`DELETE FROM categories WHERE id = $1;`, [categoryId]);

    const afterDelete = await client.query<{ count: string }>(
      `
        SELECT COUNT(*)::text AS count
        FROM prompt_categories
        WHERE prompt_id = $1 AND category_id = $2;
      `,
      [promptId, categoryId],
    );
    assert.equal(Number(afterDelete.rows[0]?.count ?? "0"), 0);
  });
});
