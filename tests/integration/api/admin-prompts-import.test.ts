import test from "node:test";
import assert from "node:assert/strict";

import { POST } from "../../../apps/web/app/api/admin/prompts/import/route.ts";
import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import {
  __getAuditLogFixtureStateForTests,
  __resetPromptLikeFixtureStateForTests,
} from "../../../apps/web/lib/api/prompt-repository.ts";

type ImportRequestItem = {
  title: string;
  slug: string;
  summary: string;
  categorySlug: string;
  content: string;
};

type ImportSuccessResponse = {
  total: number;
  mode: "all_or_nothing";
  prompts: Array<{
    slug: string;
    title: string;
    summary: string;
    categorySlug: string;
    currentVersion: {
      versionNo: string;
      sourceType: "create";
    };
  }>;
};

const adminEmail = "admin@example.com";

function postAsAdmin(items: unknown): Request {
  return new Request("http://localhost:3000/api/admin/prompts/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": adminEmail,
      "x-user-role": "admin",
    },
    body: JSON.stringify(items),
  });
}

function postAsUser(items: unknown): Request {
  return new Request("http://localhost:3000/api/admin/prompts/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": "alice@example.com",
      "x-user-role": "user",
    },
    body: JSON.stringify(items),
  });
}

async function detailStatus(slug: string): Promise<number> {
  const response = await getPromptDetail(new Request("http://localhost:3000"), {
    params: { slug },
  });
  return response.status;
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
});

test("POST /api/admin/prompts/import 成功导入多个首版 prompt 并写入审计日志", async () => {
  const items: ImportRequestItem[] = [
    {
      title: "测试导入-编程提示词",
      slug: "import-programming-assistant",
      summary: "用于验证管理员批量导入能力。",
      categorySlug: "programming",
      content: "你是一名资深工程师，请按风险等级输出改造计划。",
    },
    {
      title: "测试导入-内容提示词",
      slug: "import-content-planner",
      summary: "用于验证导入后的详情可读。",
      categorySlug: "content-creation",
      content: "请输出完整内容日历，包含主题、渠道、CTA。",
    },
  ];

  const response = await POST(postAsAdmin(items));
  const payload = (await response.json()) as ImportSuccessResponse;

  assert.equal(response.status, 201);
  assert.equal(payload.total, 2);
  assert.equal(payload.mode, "all_or_nothing");
  assert.equal(payload.prompts.length, 2);
  assert.equal(payload.prompts[0]?.slug, "import-programming-assistant");
  assert.equal(payload.prompts[0]?.currentVersion.versionNo, "v0001");
  assert.equal(payload.prompts[0]?.currentVersion.sourceType, "create");
  assert.equal(payload.prompts[1]?.slug, "import-content-planner");
  assert.equal(payload.prompts[1]?.currentVersion.versionNo, "v0001");

  assert.equal(await detailStatus("import-programming-assistant"), 200);
  assert.equal(await detailStatus("import-content-planner"), 200);

  const logs = __getAuditLogFixtureStateForTests();
  const createdLogs = logs.filter((entry) => entry.action === "prompt.created");
  assert.equal(createdLogs.length, 2);
});

test("POST /api/admin/prompts/import 禁止非 admin 访问", async () => {
  const response = await POST(postAsUser([]));
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 403);
  assert.equal(typeof payload.error, "string");
  assert.equal(payload.code, "admin_role_required");
});

test("POST /api/admin/prompts/import 在空数组时返回 400", async () => {
  const response = await POST(postAsAdmin([]));
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 400);
  assert.equal(payload.code, "invalid_import_payload");
});

test("POST /api/admin/prompts/import 在单项字段缺失时返回 400", async () => {
  const response = await POST(
    postAsAdmin([
      {
        slug: "import-invalid-item",
        summary: "字段缺失",
        categorySlug: "programming",
        content: "missing title",
      },
    ]),
  );
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 400);
  assert.equal(payload.code, "invalid_import_item");
});

test("POST /api/admin/prompts/import 在 slug 冲突时返回 409", async () => {
  const response = await POST(
    postAsAdmin([
      {
        title: "冲突测试",
        slug: "js-code-reviewer",
        summary: "与 fixture 现有 slug 冲突",
        categorySlug: "programming",
        content: "冲突内容",
      },
    ]),
  );
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 409);
  assert.equal(payload.code, "prompt_slug_conflict");
});

test("POST /api/admin/prompts/import 在分类不存在时返回 404", async () => {
  const response = await POST(
    postAsAdmin([
      {
        title: "未知分类导入",
        slug: "import-unknown-category",
        summary: "分类不存在",
        categorySlug: "not-exist-category",
        content: "分类不存在时应失败",
      },
    ]),
  );
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 404);
  assert.equal(payload.code, "category_not_found");
});

test("POST /api/admin/prompts/import 在批次失败时应整体回滚", async () => {
  const rollbackSlug = "import-should-rollback";
  const response = await POST(
    postAsAdmin([
      {
        title: "应回滚项",
        slug: rollbackSlug,
        summary: "如果批次失败，该条不应落库",
        categorySlug: "programming",
        content: "先通过校验",
      },
      {
        title: "触发失败项",
        slug: "import-fail-by-category",
        summary: "分类不存在触发失败",
        categorySlug: "not-exist-category",
        content: "应触发整批回滚",
      },
    ]),
  );
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 404);
  assert.equal(payload.code, "category_not_found");
  assert.equal(await detailStatus(rollbackSlug), 404);

  const logs = __getAuditLogFixtureStateForTests();
  const createdLogs = logs.filter(
    (entry) =>
      entry.action === "prompt.created" &&
      entry.payloadJson.promptSlug === rollbackSlug,
  );
  assert.equal(createdLogs.length, 0);
});
