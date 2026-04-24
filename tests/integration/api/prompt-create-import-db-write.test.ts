import test from "node:test";
import assert from "node:assert/strict";

const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";

process.env.DATABASE_URL = testDbUrl;
delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;

let modulesLoaded = false;
let clientModule: {
  isPgReachable: (url: string) => Promise<boolean>;
  withPgClient: <T>(
    url: string,
    run: (client: {
      query: <R extends Record<string, unknown>>(
        sql: string,
        params?: unknown[],
      ) => Promise<{ rows: R[] }>;
    }) => Promise<T>,
  ) => Promise<T>;
};
let seedModule: {
  seedDatabase: (url: string, options: { reset: boolean }) => Promise<unknown>;
};
let repositoryModule: {
  __resetPromptLikeFixtureStateForTests: () => void;
  createPrompt: (input: {
    creatorEmail: string;
    creatorRole: "admin" | "user";
    slug: string;
    title: string;
    summary: string;
    categorySlug: string;
    content: string;
  }) => Promise<
    | {
        ok: true;
        value: {
          prompt: {
            slug: string;
            categorySlug: string;
          };
        };
      }
    | {
        ok: false;
        code: string;
        message: string;
      }
  >;
  importPrompts: (input: {
    creatorEmail: string;
    creatorRole: "admin" | "user";
    items: Array<{
      slug: string;
      title: string;
      summary: string;
      categorySlug: string;
      content: string;
    }>;
  }) => Promise<
    | {
        ok: true;
        value: {
          total: number;
          prompts: Array<{
            slug: string;
            categorySlug: string;
          }>;
        };
      }
    | {
        ok: false;
        code: string;
        message: string;
      }
  >;
  getPromptDetail: (slug: string) => Promise<
    | {
        slug: string;
        category: {
          slug: string;
          name: string;
        };
      }
    | null
  >;
};

async function loadModules(): Promise<void> {
  if (modulesLoaded) {
    return;
  }

  clientModule = await import("../../../packages/db/src/client.ts");
  seedModule = await import("../../../packages/db/src/seed.ts");
  repositoryModule = await import("../../../apps/web/lib/api/prompt-repository.ts");
  modulesLoaded = true;
}

async function ensureDbReady(t: test.TestContext): Promise<boolean> {
  await loadModules();
  if (!(await clientModule.isPgReachable(testDbUrl))) {
    t.skip(`测试库不可达，跳过真实 DB 写路径断言: ${testDbUrl}`);
    return false;
  }
  return true;
}

async function resetDbSeed(): Promise<void> {
  await seedModule.seedDatabase(testDbUrl, { reset: true });
  repositoryModule.__resetPromptLikeFixtureStateForTests();
}

async function queryPromptCategorySlugs(promptSlug: string): Promise<string[]> {
  return clientModule.withPgClient(testDbUrl, async (client) => {
    const result = await client.query<{ slug: string }>(
      `
        SELECT c.slug
        FROM prompts p
        INNER JOIN prompt_categories pc ON pc.prompt_id = p.id
        INNER JOIN categories c ON c.id = pc.category_id
        WHERE p.slug = $1
        ORDER BY c.slug ASC;
      `,
      [promptSlug],
    );
    return result.rows.map((row) => row.slug);
  });
}

async function queryLegacyCategorySlug(promptSlug: string): Promise<string | null> {
  return clientModule.withPgClient(testDbUrl, async (client) => {
    const result = await client.query<{ slug: string }>(
      `
        SELECT c.slug
        FROM prompts p
        INNER JOIN categories c ON c.id = p.category_id
        WHERE p.slug = $1
        LIMIT 1;
      `,
      [promptSlug],
    );
    return result.rows[0]?.slug ?? null;
  });
}

test("真实DB写路径: createPrompt 会双写 prompts.category_id 与 prompt_categories", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const slug = `db-create-dual-write-${Date.now()}`;
  const created = await repositoryModule.createPrompt({
    creatorEmail: "admin@example.com",
    creatorRole: "admin",
    slug,
    title: "真实DB创建双写",
    summary: "验证 createPrompt 的双写基线",
    categorySlug: "programming",
    content: "create prompt in db with dual write",
  });

  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }
  assert.equal(created.value.prompt.slug, slug);
  assert.equal(created.value.prompt.categorySlug, "programming");

  const relationSlugs = await queryPromptCategorySlugs(slug);
  assert.deepEqual(relationSlugs, ["programming"]);

  const legacyCategorySlug = await queryLegacyCategorySlug(slug);
  assert.equal(legacyCategorySlug, "programming");
});

test("真实DB写路径: importPrompts 会为每条记录写入 prompt_categories", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const slugA = `db-import-dual-write-a-${Date.now()}`;
  const slugB = `db-import-dual-write-b-${Date.now()}`;
  const imported = await repositoryModule.importPrompts({
    creatorEmail: "admin@example.com",
    creatorRole: "admin",
    items: [
      {
        slug: slugA,
        title: "真实DB导入A",
        summary: "导入双写A",
        categorySlug: "programming",
        content: "import item A",
      },
      {
        slug: slugB,
        title: "真实DB导入B",
        summary: "导入双写B",
        categorySlug: "content-creation",
        content: "import item B",
      },
    ],
  });

  assert.equal(imported.ok, true);
  if (!imported.ok) {
    return;
  }
  assert.equal(imported.value.total, 2);

  assert.deepEqual(await queryPromptCategorySlugs(slugA), ["programming"]);
  assert.deepEqual(await queryPromptCategorySlugs(slugB), ["content-creation"]);
  assert.equal(await queryLegacyCategorySlug(slugA), "programming");
  assert.equal(await queryLegacyCategorySlug(slugB), "content-creation");
});

test("真实DB读取口径: 兼容字段 category 不应优先返回 uncategorized", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  await clientModule.withPgClient(testDbUrl, async (client) => {
    const promptResult = await client.query<{ id: number }>(
      `SELECT id FROM prompts WHERE slug = 'js-code-reviewer' LIMIT 1;`,
    );
    const promptId = Number(promptResult.rows[0]?.id ?? 0);
    assert.ok(promptId > 0, "应存在 js-code-reviewer");

    const uncategorizedResult = await client.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = 'uncategorized' LIMIT 1;`,
    );
    const uncategorizedId = Number(uncategorizedResult.rows[0]?.id ?? 0);
    assert.ok(uncategorizedId > 0, "应存在 uncategorized 分类");

    await client.query(
      `
        INSERT INTO prompt_categories (prompt_id, category_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_id, category_id) DO NOTHING;
      `,
      [promptId, uncategorizedId],
    );
  });

  const detail = await repositoryModule.getPromptDetail("js-code-reviewer");
  assert.ok(detail, "应能读取 prompt 详情");
  if (!detail) {
    return;
  }
  assert.equal(
    detail.category.slug,
    "programming",
    "兼容字段 category 应优先返回非系统分类",
  );
});
