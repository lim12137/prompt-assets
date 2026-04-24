import test from "node:test";
import assert from "node:assert/strict";

const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";

process.env.DATABASE_URL = testDbUrl;
delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;

type DbClient = {
  query: <R extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: R[] }>;
};

let modulesLoaded = false;
let clientModule: {
  isPgReachable: (url: string) => Promise<boolean>;
  withPgClient: <T>(url: string, run: (client: DbClient) => Promise<T>) => Promise<T>;
};
let seedModule: {
  seedDatabase: (url: string, options: { reset: boolean }) => Promise<unknown>;
};
let categoriesRouteModule: {
  GET: (request: Request) => Promise<Response>;
  POST: (request: Request) => Promise<Response>;
};
let categoryDeleteRouteModule: {
  DELETE: (
    request: Request,
    context: { params: { slug: string } },
  ) => Promise<Response>;
};
let promptsRouteModule: {
  POST: (request: Request) => Promise<Response>;
};

type CategoryListItem = {
  slug: string;
  name: string;
  isSystem: boolean;
  isSelectable: boolean;
  isCollapsedByDefault: boolean;
  promptCount: number;
};

type CategoryListResponse = {
  categories: CategoryListItem[];
};

type CategoryDeletePreviewResponse = {
  dryRun: true;
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
  confirmationToken: string;
  confirmationExpiresAt: string;
};

type CategoryDeleteConfirmResponse = {
  deleted: true;
  slug: string;
  impactedPromptCount: number;
  willBeUncategorizedCount: number;
  autoAssignedUncategorizedCount: number;
};

async function loadModules(): Promise<void> {
  if (modulesLoaded) {
    return;
  }

  clientModule = await import("../../../packages/db/src/client.ts");
  seedModule = await import("../../../packages/db/src/seed.ts");
  categoriesRouteModule = await import("../../../apps/web/app/api/admin/categories/route.ts");
  categoryDeleteRouteModule = await import(
    "../../../apps/web/app/api/admin/categories/[slug]/route.ts"
  );
  promptsRouteModule = await import("../../../apps/web/app/api/prompts/route.ts");

  modulesLoaded = true;
}

function adminHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    "x-user-email": "admin@example.com",
    "x-user-role": "admin",
  };
}

function adminPostCategoryRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/admin/categories", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
}

function adminListCategoryRequest(): Request {
  return new Request("http://localhost:3000/api/admin/categories", {
    method: "GET",
    headers: {
      "x-user-email": "admin@example.com",
      "x-user-role": "admin",
    },
  });
}

function adminDeleteCategoryRequest(
  slug: string,
  body: Record<string, unknown>,
): Request {
  return new Request(`http://localhost:3000/api/admin/categories/${slug}`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
}

function adminCreatePromptRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/prompts", {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
}

async function ensureDbReady(t: test.TestContext): Promise<boolean> {
  await loadModules();
  if (!(await clientModule.isPgReachable(testDbUrl))) {
    t.skip(`测试库不可达，跳过 admin categories 测试: ${testDbUrl}`);
    return false;
  }
  return true;
}

async function resetDbSeed(): Promise<void> {
  await seedModule.seedDatabase(testDbUrl, { reset: true });
}

async function createCategory(input: {
  name: string;
  slug: string;
}): Promise<void> {
  const response = await categoriesRouteModule.POST(
    adminPostCategoryRequest({
      name: input.name,
      slug: input.slug,
    }),
  );
  assert.equal(response.status, 201);
}

async function createPrompt(input: {
  slug: string;
  title: string;
  summary: string;
  categorySlug: string;
}): Promise<void> {
  const response = await promptsRouteModule.POST(
    adminCreatePromptRequest({
      slug: input.slug,
      title: input.title,
      summary: input.summary,
      categorySlug: input.categorySlug,
      content: `content for ${input.slug}`,
    }),
  );
  assert.equal(response.status, 201);
}

async function addPromptCategoryRelation(
  promptSlug: string,
  categorySlug: string,
): Promise<void> {
  await clientModule.withPgClient(testDbUrl, async (client) => {
    const promptResult = await client.query<{ id: number }>(
      `SELECT id FROM prompts WHERE slug = $1 LIMIT 1;`,
      [promptSlug],
    );
    const categoryResult = await client.query<{ id: number }>(
      `SELECT id FROM categories WHERE slug = $1 LIMIT 1;`,
      [categorySlug],
    );
    const promptId = Number(promptResult.rows[0]?.id ?? 0);
    const categoryId = Number(categoryResult.rows[0]?.id ?? 0);
    assert.ok(promptId > 0, `prompt 不存在: ${promptSlug}`);
    assert.ok(categoryId > 0, `category 不存在: ${categorySlug}`);

    await client.query(
      `
        INSERT INTO prompt_categories (prompt_id, category_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_id, category_id) DO NOTHING;
      `,
      [promptId, categoryId],
    );
  });
}

async function getPromptCategorySlugs(promptSlug: string): Promise<string[]> {
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

async function getPromptLegacyCategorySlug(promptSlug: string): Promise<string | null> {
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

async function categoryExists(slug: string): Promise<boolean> {
  return clientModule.withPgClient(testDbUrl, async (client) => {
    const result = await client.query<{ exists: boolean }>(
      `
        SELECT EXISTS (
          SELECT 1 FROM categories WHERE slug = $1
        ) AS exists;
      `,
      [slug],
    );
    return Boolean(result.rows[0]?.exists);
  });
}

test("GET /api/admin/categories 返回分类列表（含系统待分类）", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const response = await categoriesRouteModule.GET(adminListCategoryRequest());
  const payload = (await response.json()) as CategoryListResponse;

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.categories));
  const uncategorized = payload.categories.find((item) => item.slug === "uncategorized");
  assert.ok(uncategorized, "应包含系统分类 uncategorized");
  assert.equal(uncategorized?.isSystem, true);
  assert.equal(uncategorized?.isSelectable, false);
  assert.equal(uncategorized?.isCollapsedByDefault, true);
});

test("POST /api/admin/categories 可新增分类", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const slug = `task2-create-${Date.now()}`;
  const response = await categoriesRouteModule.POST(
    adminPostCategoryRequest({
      name: "Task2 新分类",
      slug,
    }),
  );
  const payload = (await response.json()) as {
    category: CategoryListItem;
  };

  assert.equal(response.status, 201);
  assert.equal(payload.category.slug, slug);
  assert.equal(payload.category.name, "Task2 新分类");
  assert.equal(payload.category.isSystem, false);
  assert.equal(payload.category.isSelectable, true);
  assert.equal(payload.category.isCollapsedByDefault, false);
  assert.equal(await categoryExists(slug), true);
});

test("DELETE /api/admin/categories/[slug] 预检查返回计数与确认 token", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const categorySlug = `task2-precheck-${Date.now()}`;
  const promptSlug = `task2-precheck-prompt-${Date.now()}`;
  await createCategory({ name: "预检查分类", slug: categorySlug });
  await createPrompt({
    slug: promptSlug,
    title: "预检查 Prompt",
    summary: "用于删除预检查",
    categorySlug,
  });

  const response = await categoryDeleteRouteModule.DELETE(
    adminDeleteCategoryRequest(categorySlug, { confirm: false }),
    { params: { slug: categorySlug } },
  );
  const payload = (await response.json()) as CategoryDeletePreviewResponse;

  assert.equal(response.status, 200);
  assert.equal(payload.dryRun, true);
  assert.equal(payload.slug, categorySlug);
  assert.equal(payload.impactedPromptCount, 1);
  assert.equal(payload.willBeUncategorizedCount, 1);
  assert.equal(payload.autoAssignedUncategorizedCount, 1);
  assert.equal(typeof payload.confirmationToken, "string");
  assert.ok(payload.confirmationToken.length > 20);
});

test("删除分类: 多分类提示词删一类后不进入待分类", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const categoryA = `task2-multi-a-${Date.now()}`;
  const categoryB = `task2-multi-b-${Date.now()}`;
  const promptSlug = `task2-multi-prompt-${Date.now()}`;
  await createCategory({ name: "多分类A", slug: categoryA });
  await createCategory({ name: "多分类B", slug: categoryB });
  await createPrompt({
    slug: promptSlug,
    title: "多分类提示词",
    summary: "删除其中一类后不应进入待分类",
    categorySlug: categoryA,
  });
  await addPromptCategoryRelation(promptSlug, categoryB);

  const previewResponse = await categoryDeleteRouteModule.DELETE(
    adminDeleteCategoryRequest(categoryA, { confirm: false }),
    { params: { slug: categoryA } },
  );
  const previewPayload = (await previewResponse.json()) as CategoryDeletePreviewResponse;
  assert.equal(previewResponse.status, 200);
  assert.equal(previewPayload.willBeUncategorizedCount, 0);

  const confirmResponse = await categoryDeleteRouteModule.DELETE(
    adminDeleteCategoryRequest(categoryA, {
      confirm: true,
      confirmationToken: previewPayload.confirmationToken,
    }),
    { params: { slug: categoryA } },
  );
  const confirmPayload = (await confirmResponse.json()) as CategoryDeleteConfirmResponse;

  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmPayload.deleted, true);
  assert.equal(confirmPayload.autoAssignedUncategorizedCount, 0);
  assert.equal(await categoryExists(categoryA), false);

  const relationSlugs = await getPromptCategorySlugs(promptSlug);
  assert.deepEqual(relationSlugs, [categoryB]);
  assert.equal(await getPromptLegacyCategorySlug(promptSlug), categoryB);
});

test("删除分类: 单分类提示词删后自动归入待分类", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const categorySlug = `task2-single-${Date.now()}`;
  const promptSlug = `task2-single-prompt-${Date.now()}`;
  await createCategory({ name: "单分类", slug: categorySlug });
  await createPrompt({
    slug: promptSlug,
    title: "单分类提示词",
    summary: "删除后应进入待分类",
    categorySlug,
  });

  const previewResponse = await categoryDeleteRouteModule.DELETE(
    adminDeleteCategoryRequest(categorySlug, { confirm: false }),
    { params: { slug: categorySlug } },
  );
  const previewPayload = (await previewResponse.json()) as CategoryDeletePreviewResponse;
  assert.equal(previewResponse.status, 200);
  assert.equal(previewPayload.willBeUncategorizedCount, 1);

  const confirmResponse = await categoryDeleteRouteModule.DELETE(
    adminDeleteCategoryRequest(categorySlug, {
      confirm: true,
      confirmationToken: previewPayload.confirmationToken,
    }),
    { params: { slug: categorySlug } },
  );
  const confirmPayload = (await confirmResponse.json()) as CategoryDeleteConfirmResponse;

  assert.equal(confirmResponse.status, 200);
  assert.equal(confirmPayload.autoAssignedUncategorizedCount, 1);
  assert.equal(await categoryExists(categorySlug), false);
  assert.deepEqual(await getPromptCategorySlugs(promptSlug), ["uncategorized"]);
  assert.equal(await getPromptLegacyCategorySlug(promptSlug), "uncategorized");
});

test("DELETE /api/admin/categories/[slug] 在确认 token 非法时返回 400", async (t) => {
  if (!(await ensureDbReady(t))) {
    return;
  }
  await resetDbSeed();

  const categorySlug = `task2-invalid-token-${Date.now()}`;
  await createCategory({ name: "非法 token 分类", slug: categorySlug });

  const response = await categoryDeleteRouteModule.DELETE(
    adminDeleteCategoryRequest(categorySlug, {
      confirm: true,
      confirmationToken: "invalid.token",
    }),
    { params: { slug: categorySlug } },
  );
  const payload = (await response.json()) as {
    error: string;
    code: string;
  };

  assert.equal(response.status, 400);
  assert.equal(payload.code, "invalid_confirmation_token");
  assert.equal(await categoryExists(categorySlug), true);
});
