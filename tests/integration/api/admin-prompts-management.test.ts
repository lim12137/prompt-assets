import test from "node:test";
import assert from "node:assert/strict";

import { buildAuthCookie } from "./_auth-test-helpers.ts";

const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";

process.env.DATABASE_URL = testDbUrl;
delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
process.env.LOGIN_TOKEN_SECRET = "test-secret";

type DbClient = {
  query: <R extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: R[] }>;
};

type PromptStatus = "draft" | "published" | "archived";

type AdminPromptListItem = {
  slug: string;
  title: string;
  summary: string;
  status: PromptStatus;
  updatedAt: string;
  category: {
    slug: string;
    name: string;
  };
  categories: Array<{
    slug: string;
    name: string;
  }>;
  categorySlugs: string[];
};

type AdminPromptListResponse = {
  prompts: AdminPromptListItem[];
};

type AdminPromptDeletePreviewResponse = {
  dryRun: true;
  slug: string;
  title: string;
  status: PromptStatus;
  primaryCategory: {
    slug: string;
    name: string;
  };
  categories: Array<{
    slug: string;
    name: string;
  }>;
  relatedCounts: {
    versions: number;
    submissions: number;
    likes: number;
    versionLikes: number;
    versionScores: number;
    dailyInteractions: number;
  };
  confirmationToken: string;
  confirmationExpiresAt: string;
};

type AdminPromptDeleteConfirmResponse = {
  deleted: true;
  slug: string;
  deletedCounts: AdminPromptDeletePreviewResponse["relatedCounts"];
};

let modulesLoaded = false;
let dbReachabilityChecked = false;
let dbReachable = false;
let clientModule: {
  isPgReachable: (url: string, timeoutMs?: number) => Promise<boolean>;
  withPgClient: <T>(url: string, run: (client: DbClient) => Promise<T>) => Promise<T>;
};
let seedModule: {
  seedDatabase: (url: string, options: { reset: boolean }) => Promise<unknown>;
};
let repositoryModule: {
  createAdminCategory: (input: {
    creatorEmail: string;
    creatorRole: "admin" | "user";
    name: string;
    slug: string;
  }) => Promise<{ ok: boolean }>;
  createPrompt: (input: {
    creatorEmail: string;
    creatorRole: "admin" | "user";
    slug: string;
    title: string;
    summary: string;
    categorySlug?: string;
    categorySlugs?: string[];
    content: string;
  }) => Promise<{ ok: boolean }>;
  __resetPromptLikeFixtureStateForTests: () => void;
};
let adminPromptsRouteModule: {
  GET: (request: Request) => Promise<Response>;
};
let adminPromptRouteModule: {
  PATCH: (
    request: Request,
    context: { params: { slug: string } },
  ) => Promise<Response>;
};
let archiveRouteModule: {
  POST: (
    request: Request,
    context: { params: { slug: string } },
  ) => Promise<Response>;
};
let restoreRouteModule: {
  POST: (
    request: Request,
    context: { params: { slug: string } },
  ) => Promise<Response>;
};
let deleteRouteModule: {
  DELETE: (
    request: Request,
    context: { params: { slug: string } },
  ) => Promise<Response>;
};
let promptDetailRouteModule: {
  GET: (
    request: Request,
    context: { params: { slug: string } },
  ) => Promise<Response>;
};
let promptsListRouteModule: {
  GET: (request: Request) => Promise<Response>;
};
let lockModule: {
  withTestDbLock: <T>(task: () => Promise<T>) => Promise<T>;
};

async function loadModules(): Promise<void> {
  if (modulesLoaded) {
    return;
  }

  clientModule = await import("../../../packages/db/src/client.ts");
  seedModule = await import("../../../packages/db/src/seed.ts");
  repositoryModule = await import("../../../apps/web/lib/api/prompt-repository.ts");
  adminPromptsRouteModule = await import("../../../apps/web/app/api/admin/prompts/route.ts");
  adminPromptRouteModule = await import(
    "../../../apps/web/app/api/admin/prompts/[slug]/route.ts"
  );
  archiveRouteModule = await import(
    "../../../apps/web/app/api/admin/prompts/[slug]/archive/route.ts"
  );
  restoreRouteModule = await import(
    "../../../apps/web/app/api/admin/prompts/[slug]/restore/route.ts"
  );
  deleteRouteModule = await import(
    "../../../apps/web/app/api/admin/prompts/[slug]/delete/route.ts"
  );
  promptDetailRouteModule = await import(
    "../../../apps/web/app/api/prompts/[slug]/route.ts"
  );
  promptsListRouteModule = await import("../../../apps/web/app/api/prompts/route.ts");
  lockModule = await import("../../../scripts/with-test-db-lock.mjs");

  modulesLoaded = true;
}

function adminHeaders(): HeadersInit {
  return {
    "content-type": "application/json",
    cookie: buildAuthCookie({
      uid: "admin@example.com",
      name: "Admin",
      can_manage: true,
      can_manage_whitelist: false,
    }),
  };
}

function adminGetPromptsRequest(search = ""): Request {
  return new Request(`http://localhost:3000/api/admin/prompts${search}`, {
    method: "GET",
    headers: adminHeaders(),
  });
}

function adminPatchPromptRequest(
  slug: string,
  body: Record<string, unknown>,
): Request {
  return new Request(`http://localhost:3000/api/admin/prompts/${slug}`, {
    method: "PATCH",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
}

function adminPostPromptActionRequest(
  slug: string,
  action: "archive" | "restore",
  body: Record<string, unknown> = {},
): Request {
  return new Request(`http://localhost:3000/api/admin/prompts/${slug}/${action}`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
}

function adminDeletePromptRequest(
  slug: string,
  body: Record<string, unknown>,
): Request {
  return new Request(`http://localhost:3000/api/admin/prompts/${slug}/delete`, {
    method: "DELETE",
    headers: adminHeaders(),
    body: JSON.stringify(body),
  });
}

async function ensureDbReady(t: test.TestContext): Promise<boolean> {
  await loadModules();
  if (!dbReachabilityChecked) {
    dbReachable = await clientModule.isPgReachable(testDbUrl, 5000);
    dbReachabilityChecked = true;
  }
  if (!dbReachable) {
    t.skip(`测试库不可达，跳过 admin prompts management 测试: ${testDbUrl}`);
    return false;
  }
  return true;
}

async function withDbLifecycleLock(
  t: test.TestContext,
  run: () => Promise<void>,
): Promise<void> {
  await loadModules();
  await lockModule.withTestDbLock(async () => {
    if (!(await ensureDbReady(t))) {
      return;
    }
    await run();
  });
}

async function resetDbSeed(): Promise<void> {
  await seedModule.seedDatabase(testDbUrl, { reset: true });
  repositoryModule.__resetPromptLikeFixtureStateForTests();
}

async function createCategory(input: {
  name: string;
  slug: string;
}): Promise<void> {
  const result = await repositoryModule.createAdminCategory({
    creatorEmail: "admin@example.com",
    creatorRole: "admin",
    name: input.name,
    slug: input.slug,
  });
  assert.equal(result.ok, true);
}

async function createPrompt(input: {
  slug: string;
  title: string;
  summary: string;
  categorySlug?: string;
  categorySlugs?: string[];
  content?: string;
}): Promise<void> {
  const result = await repositoryModule.createPrompt({
    creatorEmail: "admin@example.com",
    creatorRole: "admin",
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    categorySlug: input.categorySlug,
    categorySlugs: input.categorySlugs,
    content: input.content ?? `content for ${input.slug}`,
  });
  assert.equal(result.ok, true);
}

async function setPromptStatus(slug: string, status: PromptStatus): Promise<void> {
  await clientModule.withPgClient(testDbUrl, async (client) => {
    await client.query(
      `
        UPDATE prompts
        SET status = $2, updated_at = NOW()
        WHERE slug = $1;
      `,
      [slug, status],
    );
  });
}

async function addPromptOperationalData(promptSlug: string): Promise<void> {
  await clientModule.withPgClient(testDbUrl, async (client) => {
    const promptResult = await client.query<{
      id: number;
      current_version_id: number;
    }>(
      `
        SELECT id, current_version_id
        FROM prompts
        WHERE slug = $1
        LIMIT 1;
      `,
      [promptSlug],
    );
    const promptId = Number(promptResult.rows[0]?.id ?? 0);
    const currentVersionId = Number(promptResult.rows[0]?.current_version_id ?? 0);
    assert.ok(promptId > 0, `prompt 不存在: ${promptSlug}`);
    assert.ok(currentVersionId > 0, `prompt 当前版本不存在: ${promptSlug}`);

    const baseVersionResult = await client.query<{ version_no: string }>(
      `
        SELECT version_no
        FROM prompt_versions
        WHERE id = $1
        LIMIT 1;
      `,
      [currentVersionId],
    );
    const baseVersionNo = baseVersionResult.rows[0]?.version_no ?? "v0001";

    const adminId = await ensureUserId(client, "admin@example.com", "admin");
    const memberId = await ensureUserId(client, "ops-auditor@example.com", "user");
    const candidateVersionResult = await client.query<{ id: number }>(
      `
        INSERT INTO prompt_versions (
          prompt_id,
          version_no,
          content,
          change_note,
          source_type,
          submitted_by
        )
        VALUES ($1, 'v0002', $2, 'cleanup candidate', 'submission', $3)
        RETURNING id;
      `,
      [promptId, `candidate for ${promptSlug}`, memberId],
    );
    const candidateVersionId = Number(candidateVersionResult.rows[0]?.id ?? 0);
    assert.ok(candidateVersionId > 0, "候选版本创建失败");

    await client.query(
      `
        INSERT INTO submissions (
          prompt_id,
          base_version_id,
          candidate_version_id,
          submitter_id,
          status
        )
        VALUES ($1, $2, $3, $4, 'pending');
      `,
      [promptId, currentVersionId, candidateVersionId, memberId],
    );

    await client.query(
      `
        INSERT INTO prompt_likes (prompt_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_id, user_id) DO NOTHING;
      `,
      [promptId, memberId],
    );
    await client.query(
      `
        UPDATE prompts
        SET likes_count = 1
        WHERE id = $1;
      `,
      [promptId],
    );

    await client.query(
      `
        INSERT INTO prompt_version_likes (prompt_version_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_version_id, user_id) DO NOTHING;
      `,
      [currentVersionId, memberId],
    );
    await client.query(
      `
        UPDATE prompt_versions
        SET likes_count = 1
        WHERE id = $1;
      `,
      [currentVersionId],
    );

    await client.query(
      `
        INSERT INTO prompt_version_scores (
          prompt_version_id,
          user_id,
          scene,
          trace_id,
          score
        )
        VALUES ($1, $2, 'admin-cleanup', 'trace-cleanup', 2)
        ON CONFLICT (prompt_version_id, scene, trace_id)
        DO NOTHING;
      `,
      [currentVersionId, memberId],
    );

    await client.query(
      `
        INSERT INTO prompt_version_daily_interactions (
          prompt_version_id,
          action,
          ip_hash,
          date_key
        )
        VALUES ($1, 'score', 'hash-cleanup', '2026-05-01')
        ON CONFLICT (prompt_version_id, action, ip_hash, date_key)
        DO NOTHING;
      `,
      [currentVersionId],
    );

    await client.query(
      `
        INSERT INTO audit_logs (actor_id, action, target_type, target_id, payload_json)
        VALUES (
          $1,
          'prompt.created',
          'prompt',
          $2,
          $3::jsonb
        );
      `,
      [adminId, promptId, JSON.stringify({ promptSlug, versionNo: baseVersionNo })],
    );
  });
}

async function ensureUserId(
  client: DbClient,
  email: string,
  role: "user" | "admin",
): Promise<number> {
  const result = await client.query<{ id: number }>(
    `
      INSERT INTO users (email, role)
      VALUES ($1, $2)
      ON CONFLICT (email)
      DO UPDATE SET role = EXCLUDED.role
      RETURNING id;
    `,
    [email, role],
  );
  return Number(result.rows[0]?.id ?? 0);
}

async function queryPromptSnapshot(promptSlug: string): Promise<{
  status: PromptStatus;
  primaryCategorySlug: string;
  categorySlugs: string[];
} | null> {
  return clientModule.withPgClient(testDbUrl, async (client) => {
    const headResult = await client.query<{
      status: PromptStatus;
      primary_category_slug: string;
    }>(
      `
        SELECT
          p.status,
          c.slug AS primary_category_slug
        FROM prompts p
        INNER JOIN categories c ON c.id = p.category_id
        WHERE p.slug = $1
        LIMIT 1;
      `,
      [promptSlug],
    );
    const head = headResult.rows[0];
    if (!head) {
      return null;
    }

    const categoriesResult = await client.query<{ slug: string }>(
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

    return {
      status: head.status,
      primaryCategorySlug: head.primary_category_slug,
      categorySlugs: categoriesResult.rows.map((row) => row.slug),
    };
  });
}

async function countPromptBusinessRelations(promptSlug: string): Promise<{
  prompts: number;
  promptCategories: number;
  promptVersions: number;
  submissions: number;
  promptLikes: number;
  promptVersionLikes: number;
  promptVersionScores: number;
  promptVersionDailyInteractions: number;
}> {
  return clientModule.withPgClient(testDbUrl, async (client) => {
    const result = await client.query<{
      prompts: string;
      prompt_categories: string;
      prompt_versions: string;
      submissions: string;
      prompt_likes: string;
      prompt_version_likes: string;
      prompt_version_scores: string;
      prompt_version_daily_interactions: string;
    }>(
      `
        WITH target_prompt AS (
          SELECT id, current_version_id
          FROM prompts
          WHERE slug = $1
        ),
        target_versions AS (
          SELECT pv.id
          FROM prompt_versions pv
          INNER JOIN target_prompt tp ON tp.id = pv.prompt_id
        )
        SELECT
          (SELECT COUNT(*)::text FROM target_prompt) AS prompts,
          (SELECT COUNT(*)::text FROM prompt_categories pc INNER JOIN target_prompt tp ON tp.id = pc.prompt_id) AS prompt_categories,
          (SELECT COUNT(*)::text FROM target_versions) AS prompt_versions,
          (SELECT COUNT(*)::text FROM submissions s INNER JOIN target_prompt tp ON tp.id = s.prompt_id) AS submissions,
          (SELECT COUNT(*)::text FROM prompt_likes pl INNER JOIN target_prompt tp ON tp.id = pl.prompt_id) AS prompt_likes,
          (SELECT COUNT(*)::text FROM prompt_version_likes pvl INNER JOIN target_versions tv ON tv.id = pvl.prompt_version_id) AS prompt_version_likes,
          (SELECT COUNT(*)::text FROM prompt_version_scores pvs INNER JOIN target_versions tv ON tv.id = pvs.prompt_version_id) AS prompt_version_scores,
          (SELECT COUNT(*)::text FROM prompt_version_daily_interactions pvdi INNER JOIN target_versions tv ON tv.id = pvdi.prompt_version_id) AS prompt_version_daily_interactions;
      `,
      [promptSlug],
    );
    const row = result.rows[0];
    return {
      prompts: Number(row?.prompts ?? 0),
      promptCategories: Number(row?.prompt_categories ?? 0),
      promptVersions: Number(row?.prompt_versions ?? 0),
      submissions: Number(row?.submissions ?? 0),
      promptLikes: Number(row?.prompt_likes ?? 0),
      promptVersionLikes: Number(row?.prompt_version_likes ?? 0),
      promptVersionScores: Number(row?.prompt_version_scores ?? 0),
      promptVersionDailyInteractions: Number(row?.prompt_version_daily_interactions ?? 0),
    };
  });
}

async function queryAuditActions(promptSlug: string): Promise<string[]> {
  return clientModule.withPgClient(testDbUrl, async (client) => {
    const result = await client.query<{ action: string }>(
      `
        SELECT action
        FROM audit_logs
        WHERE payload_json ->> 'promptSlug' = $1
        ORDER BY id ASC;
      `,
      [promptSlug],
    );
    return result.rows.map((row) => row.action);
  });
}

test("GET /api/admin/prompts 支持状态、分类、关键词筛选", async (t) => {
  await withDbLifecycleLock(t, async () => {
    await resetDbSeed();

    const marker = Date.now();
    const categorySlug = `mgmt-filter-${marker}`;
    await createCategory({ name: "管理筛选分类", slug: categorySlug });
    await createPrompt({
      slug: `mgmt-filter-published-${marker}`,
      title: "管理筛选 已发布 Prompt",
      summary: "用于 published + 分类 + 关键词筛选",
      categorySlugs: [categorySlug, "design"],
    });
    await createPrompt({
      slug: `mgmt-filter-archived-${marker}`,
      title: "管理筛选 已归档 Prompt",
      summary: "用于 archived + 分类 + 关键词筛选",
      categorySlugs: [categorySlug],
    });
    await setPromptStatus(`mgmt-filter-archived-${marker}`, "archived");

    const response = await adminPromptsRouteModule.GET(
      adminGetPromptsRequest(
        `?status=archived&category=${encodeURIComponent(categorySlug)}&keyword=${encodeURIComponent("归档")}`,
      ),
    );
    const payload = (await response.json()) as AdminPromptListResponse;

    assert.equal(response.status, 200);
    assert.equal(payload.prompts.length, 1);
    assert.equal(payload.prompts[0]?.slug, `mgmt-filter-archived-${marker}`);
    assert.equal(payload.prompts[0]?.status, "archived");
    assert.equal(payload.prompts[0]?.category.slug, categorySlug);
    assert.deepEqual(payload.prompts[0]?.categorySlugs, [categorySlug]);
  });
});

test("GET /api/admin/prompts 在 0 个已发布 prompt 时仍读取真实库管理数据", async (t) => {
  await withDbLifecycleLock(t, async () => {
    await resetDbSeed();

    const marker = Date.now();
    const slug = `mgmt-zero-published-${marker}`;
    await createPrompt({
      slug,
      title: "零已发布管理 Prompt",
      summary: "验证后台管理列表不会回退到 fixture",
      categorySlugs: ["programming"],
    });

    await clientModule.withPgClient(testDbUrl, async (client) => {
      await client.query(
        `
          UPDATE prompts
          SET status = 'archived', updated_at = NOW();
        `,
      );
    });
    repositoryModule.__resetPromptLikeFixtureStateForTests();

    const response = await adminPromptsRouteModule.GET(
      adminGetPromptsRequest(`?status=archived&keyword=${encodeURIComponent(slug)}`),
    );
    const payload = (await response.json()) as AdminPromptListResponse;

    assert.equal(response.status, 200);
    assert.equal(payload.prompts.length, 1);
    assert.equal(payload.prompts[0]?.slug, slug);
    assert.equal(payload.prompts[0]?.status, "archived");
  });
});

test("POST /api/admin/prompts/[slug]/archive 与 restore 可切换状态并影响前台可见性", async (t) => {
  await withDbLifecycleLock(t, async () => {
    await resetDbSeed();

    const slug = `mgmt-archive-restore-${Date.now()}`;
    await createPrompt({
      slug,
      title: "归档恢复治理 Prompt",
      summary: "验证归档恢复后端链路",
      categorySlugs: ["programming"],
    });

    const archiveResponse = await archiveRouteModule.POST(
      adminPostPromptActionRequest(slug, "archive"),
      { params: { slug } },
    );
    assert.equal(archiveResponse.status, 200);

    const archivedSnapshot = await queryPromptSnapshot(slug);
    assert.equal(archivedSnapshot?.status, "archived");

    const publicListResponse = await promptsListRouteModule.GET(
      new Request(`http://localhost:3000/api/prompts?keyword=${encodeURIComponent(slug)}`),
    );
    const publicListPayload = (await publicListResponse.json()) as Array<{ slug: string }>;
    assert.equal(
      publicListPayload.some((item) => item.slug === slug),
      false,
      "归档后前台列表不应再返回",
    );

    const publicDetailResponse = await promptDetailRouteModule.GET(
      new Request("http://localhost:3000/api/prompts/detail"),
      { params: { slug } },
    );
    assert.equal(publicDetailResponse.status, 404);

    const restoreResponse = await restoreRouteModule.POST(
      adminPostPromptActionRequest(slug, "restore"),
      { params: { slug } },
    );
    assert.equal(restoreResponse.status, 200);

    const restoredSnapshot = await queryPromptSnapshot(slug);
    assert.equal(restoredSnapshot?.status, "published");

    const restoredDetailResponse = await promptDetailRouteModule.GET(
      new Request("http://localhost:3000/api/prompts/detail"),
      { params: { slug } },
    );
    assert.equal(restoredDetailResponse.status, 200);
  });
});

test("PATCH /api/admin/prompts/[slug] 在 0 个已发布 prompt 时仍更新真实库分类", async (t) => {
  await withDbLifecycleLock(t, async () => {
    await resetDbSeed();

    const marker = Date.now();
    const targetCategorySlug = `mgmt-zero-published-category-${marker}`;
    const promptSlug = `mgmt-zero-published-edit-${marker}`;
    await createCategory({ name: "零已发布分类", slug: targetCategorySlug });
    await createPrompt({
      slug: promptSlug,
      title: "零已发布分类编辑 Prompt",
      summary: "验证后台管理编辑不会回退到 fixture",
      categorySlugs: ["uncategorized"],
    });

    await clientModule.withPgClient(testDbUrl, async (client) => {
      await client.query(
        `
          UPDATE prompts
          SET status = 'archived', updated_at = NOW();
        `,
      );
    });
    repositoryModule.__resetPromptLikeFixtureStateForTests();

    const response = await adminPromptRouteModule.PATCH(
      adminPatchPromptRequest(promptSlug, {
        categorySlugs: [targetCategorySlug],
        primaryCategorySlug: targetCategorySlug,
      }),
      { params: { slug: promptSlug } },
    );
    const payload = (await response.json()) as {
      prompt: {
        slug: string;
        category: { slug: string };
        categorySlugs: string[];
      };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.prompt.slug, promptSlug);
    assert.equal(payload.prompt.category.slug, targetCategorySlug);
    assert.deepEqual(payload.prompt.categorySlugs, [targetCategorySlug]);

    const snapshot = await queryPromptSnapshot(promptSlug);
    assert.equal(snapshot?.status, "archived");
    assert.equal(snapshot?.primaryCategorySlug, targetCategorySlug);
    assert.deepEqual(snapshot?.categorySlugs, [targetCategorySlug]);
  });
});

test("PATCH /api/admin/prompts/[slug] 可更新多分类与主分类并自动移除 uncategorized", async (t) => {
  await withDbLifecycleLock(t, async () => {
    await resetDbSeed();

    const marker = Date.now();
    const primarySlug = `mgmt-primary-${marker}`;
    const secondarySlug = `mgmt-secondary-${marker}`;
    const promptSlug = `mgmt-category-edit-${marker}`;
    await createCategory({ name: "主分类候选", slug: primarySlug });
    await createCategory({ name: "副分类候选", slug: secondarySlug });
    await createPrompt({
      slug: promptSlug,
      title: "分类编辑 Prompt",
      summary: "验证主分类真源与多分类补充",
      categorySlugs: ["uncategorized"],
    });

    const response = await adminPromptRouteModule.PATCH(
      adminPatchPromptRequest(promptSlug, {
        categorySlugs: ["uncategorized", primarySlug, secondarySlug],
        primaryCategorySlug: secondarySlug,
      }),
      { params: { slug: promptSlug } },
    );
    const payload = (await response.json()) as {
      prompt: {
        slug: string;
        category: { slug: string };
        categorySlugs: string[];
      };
    };

    assert.equal(response.status, 200);
    assert.equal(payload.prompt.slug, promptSlug);
    assert.equal(payload.prompt.category.slug, secondarySlug);
    assert.deepEqual(payload.prompt.categorySlugs, [primarySlug, secondarySlug]);

    const snapshot = await queryPromptSnapshot(promptSlug);
    assert.equal(snapshot?.primaryCategorySlug, secondarySlug);
    assert.deepEqual(snapshot?.categorySlugs, [primarySlug, secondarySlug]);
  });
});

test("DELETE /api/admin/prompts/[slug]/delete 先 dry-run 再 confirm，并级联删除关联业务数据", async (t) => {
  await withDbLifecycleLock(t, async () => {
    await resetDbSeed();

    const slug = `mgmt-hard-delete-${Date.now()}`;
    await createPrompt({
      slug,
      title: "彻底删除治理 Prompt",
      summary: "验证 dry-run + confirm 物理删除",
      categorySlugs: ["programming", "design"],
    });
    await addPromptOperationalData(slug);

    const previewResponse = await deleteRouteModule.DELETE(
      adminDeletePromptRequest(slug, { confirm: false }),
      { params: { slug } },
    );
    const previewPayload = (await previewResponse.json()) as AdminPromptDeletePreviewResponse;

    assert.equal(previewResponse.status, 200);
    assert.equal(previewPayload.dryRun, true);
    assert.equal(previewPayload.slug, slug);
    assert.equal(previewPayload.status, "published");
    assert.equal(previewPayload.primaryCategory.slug, "programming");
    assert.deepEqual(
      previewPayload.categories.map((item) => item.slug),
      ["programming", "design"],
    );
    assert.deepEqual(previewPayload.relatedCounts, {
      versions: 2,
      submissions: 1,
      likes: 1,
      versionLikes: 1,
      versionScores: 1,
      dailyInteractions: 1,
    });
    assert.ok(previewPayload.confirmationToken.length > 20);

    const confirmResponse = await deleteRouteModule.DELETE(
      adminDeletePromptRequest(slug, {
        confirm: true,
        confirmationToken: previewPayload.confirmationToken,
        reason: "后台样例治理",
      }),
      { params: { slug } },
    );
    const confirmPayload = (await confirmResponse.json()) as AdminPromptDeleteConfirmResponse;

    assert.equal(confirmResponse.status, 200);
    assert.equal(confirmPayload.deleted, true);
    assert.equal(confirmPayload.slug, slug);
    assert.deepEqual(confirmPayload.deletedCounts, previewPayload.relatedCounts);

    assert.deepEqual(await countPromptBusinessRelations(slug), {
      prompts: 0,
      promptCategories: 0,
      promptVersions: 0,
      submissions: 0,
      promptLikes: 0,
      promptVersionLikes: 0,
      promptVersionScores: 0,
      promptVersionDailyInteractions: 0,
    });

    const detailResponse = await promptDetailRouteModule.GET(
      new Request("http://localhost:3000/api/prompts/detail"),
      { params: { slug } },
    );
    assert.equal(detailResponse.status, 404);
  });
});

test("管理动作写入审计：归档、恢复、分类更新、彻底删除", async (t) => {
  await withDbLifecycleLock(t, async () => {
    await resetDbSeed();

    const marker = Date.now();
    const categorySlug = `mgmt-audit-${marker}`;
    const promptSlug = `mgmt-audit-prompt-${marker}`;
    await createCategory({ name: "审计分类", slug: categorySlug });
    await createPrompt({
      slug: promptSlug,
      title: "管理动作审计 Prompt",
      summary: "验证 prompt 管理动作审计补齐",
      categorySlugs: ["uncategorized"],
    });

    const archiveResponse = await archiveRouteModule.POST(
      adminPostPromptActionRequest(promptSlug, "archive"),
      { params: { slug: promptSlug } },
    );
    assert.equal(archiveResponse.status, 200);

    const restoreResponse = await restoreRouteModule.POST(
      adminPostPromptActionRequest(promptSlug, "restore"),
      { params: { slug: promptSlug } },
    );
    assert.equal(restoreResponse.status, 200);

    const patchResponse = await adminPromptRouteModule.PATCH(
      adminPatchPromptRequest(promptSlug, {
        categorySlugs: [categorySlug],
        primaryCategorySlug: categorySlug,
      }),
      { params: { slug: promptSlug } },
    );
    assert.equal(patchResponse.status, 200);

    const previewResponse = await deleteRouteModule.DELETE(
      adminDeletePromptRequest(promptSlug, { confirm: false }),
      { params: { slug: promptSlug } },
    );
    const previewPayload = (await previewResponse.json()) as AdminPromptDeletePreviewResponse;
    assert.equal(previewResponse.status, 200);

    const deleteResponse = await deleteRouteModule.DELETE(
      adminDeletePromptRequest(promptSlug, {
        confirm: true,
        confirmationToken: previewPayload.confirmationToken,
        reason: "审计覆盖",
      }),
      { params: { slug: promptSlug } },
    );
    assert.equal(deleteResponse.status, 200);

    const actions = await queryAuditActions(promptSlug);
    assert.deepEqual(actions.slice(-4), [
      "prompt.archived",
      "prompt.restored",
      "prompt.categories.updated",
      "prompt.deleted",
    ]);
  });
});
