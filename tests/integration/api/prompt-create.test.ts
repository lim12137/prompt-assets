import test from "node:test";
import assert from "node:assert/strict";

import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import { POST } from "../../../apps/web/app/api/prompts/route.ts";
import {
  __getAuditLogFixtureStateForTests,
  __resetPromptLikeFixtureStateForTests,
} from "../../../apps/web/lib/api/prompt-repository.ts";

type CreatePromptResponse = {
  prompt: {
    slug: string;
    title: string;
    summary: string;
    categorySlug: string;
    currentVersion: {
      versionNo: string;
      sourceType: string;
    };
  };
};

type ErrorResponse = {
  error: string;
  code: string;
};

type AuditLogEntry = {
  action: string;
  targetType: string;
  targetId: number;
  payloadJson: Record<string, unknown>;
};

function adminCreateRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/prompts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": "admin@example.com",
      "x-user-role": "admin",
    },
    body: JSON.stringify(body),
  });
}

function userCreateRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/prompts", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": "alice@example.com",
      "x-user-role": "user",
    },
    body: JSON.stringify(body),
  });
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
});

test("POST /api/prompts 管理员可创建首版官方 Prompt 并写入审计日志", async () => {
  const slug = "admin-created-first-version";
  const response = await POST(
    adminCreateRequest({
      title: "管理员首版提示词",
      slug,
      summary: "用于验证管理员创建首版 Prompt 的最小流程",
      categorySlug: "programming",
      content: "你是代码助手，请先输出分析，再给最小可执行结论。",
    }),
  );
  const payload = (await response.json()) as CreatePromptResponse;

  assert.equal(response.status, 201);
  assert.equal(payload.prompt.slug, slug);
  assert.equal(payload.prompt.title, "管理员首版提示词");
  assert.equal(payload.prompt.summary, "用于验证管理员创建首版 Prompt 的最小流程");
  assert.equal(payload.prompt.categorySlug, "programming");
  assert.equal(payload.prompt.currentVersion.versionNo, "v0001");
  assert.equal(payload.prompt.currentVersion.sourceType, "create");

  const detailResponse = await getPromptDetail(new Request("http://localhost:3000"), {
    params: { slug },
  });
  assert.equal(detailResponse.status, 200);

  const logs = __getAuditLogFixtureStateForTests() as AuditLogEntry[];
  const createdLog = logs.find((item) => item.action === "prompt.created");
  assert.equal(createdLog?.targetType, "prompt");
  assert.equal(createdLog?.payloadJson.promptSlug, slug);
  assert.equal(createdLog?.payloadJson.versionNo, "v0001");
});

test("POST /api/prompts 禁止非 admin 创建", async () => {
  const response = await POST(
    userCreateRequest({
      title: "普通用户创建",
      slug: "should-not-created-by-user",
      summary: "should fail",
      categorySlug: "programming",
      content: "content",
    }),
  );
  const payload = (await response.json()) as ErrorResponse;

  assert.equal(response.status, 403);
  assert.equal(payload.code, "admin_role_required");
});

test("POST /api/prompts 必填字段缺失时返回 400", async () => {
  const response = await POST(
    adminCreateRequest({
      title: "  ",
      slug: "missing-required-fields",
      summary: "ok",
      categorySlug: "programming",
      content: "ok",
    }),
  );
  const payload = (await response.json()) as ErrorResponse;

  assert.equal(response.status, 400);
  assert.equal(payload.code, "required_fields_missing");
});

test("POST /api/prompts slug 冲突时返回 409", async () => {
  const response = await POST(
    adminCreateRequest({
      title: "冲突",
      slug: "api-debug-assistant",
      summary: "冲突测试",
      categorySlug: "programming",
      content: "冲突内容",
    }),
  );
  const payload = (await response.json()) as ErrorResponse;

  assert.equal(response.status, 409);
  assert.equal(payload.code, "prompt_slug_conflict");
});

test("POST /api/prompts 分类不存在时返回 404", async () => {
  const response = await POST(
    adminCreateRequest({
      title: "分类不存在",
      slug: "category-not-found-slug",
      summary: "分类不存在",
      categorySlug: "not-exists",
      content: "分类不存在内容",
    }),
  );
  const payload = (await response.json()) as ErrorResponse;

  assert.equal(response.status, 404);
  assert.equal(payload.code, "category_not_found");
});

test("POST /api/prompts 在未传 slug 时可按标题自动生成", async () => {
  const response = await POST(
    adminCreateRequest({
      title: "自动生成 Slug 的标题 2026",
      summary: "未显式传入 slug。",
      categorySlug: "programming",
      content: "auto slug content",
    }),
  );
  const payload = (await response.json()) as CreatePromptResponse;

  assert.equal(response.status, 201);
  assert.equal(typeof payload.prompt.slug, "string");
  assert.ok(payload.prompt.slug.length > 0);
  assert.equal(payload.prompt.title, "自动生成 Slug 的标题 2026");
});
