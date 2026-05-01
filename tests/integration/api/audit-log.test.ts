import test from "node:test";
import assert from "node:assert/strict";

import { POST as approveSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/approve/route.ts";
import { POST as rejectSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/reject/route.ts";
import { POST as archivePrompt } from "../../../apps/web/app/api/admin/prompts/[slug]/archive/route.ts";
import { POST as restorePrompt } from "../../../apps/web/app/api/admin/prompts/[slug]/restore/route.ts";
import { PATCH as updatePromptCategories } from "../../../apps/web/app/api/admin/prompts/[slug]/route.ts";
import { DELETE as deletePrompt } from "../../../apps/web/app/api/admin/prompts/[slug]/delete/route.ts";
import { POST as likePrompt } from "../../../apps/web/app/api/prompts/[slug]/like/route.ts";
import { POST as createSubmission } from "../../../apps/web/app/api/prompts/[slug]/submissions/route.ts";
import {
  __getAuditLogFixtureStateForTests,
  __resetPromptLikeFixtureStateForTests,
} from "../../../apps/web/lib/api/prompt-repository.ts";
import { buildAuthCookie } from "./_auth-test-helpers.ts";

type AuditLogEntry = {
  actorId: number | null;
  action: string;
  targetType: string;
  targetId: number;
  payloadJson: Record<string, unknown>;
};

const adminEmail = "admin@example.com";
const userEmail = "alice@example.com";

function userPost(url: string, body: Record<string, unknown> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: buildAuthCookie({ uid: userEmail, name: "Alice", can_manage: false }),
    },
    body: JSON.stringify(body),
  });
}

function adminPost(url: string, body: Record<string, unknown> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: buildAuthCookie({ uid: adminEmail, name: "Admin", can_manage: true }),
    },
    body: JSON.stringify(body),
  });
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  process.env.LOGIN_TOKEN_SECRET = "test-secret";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
  delete process.env.LOGIN_TOKEN_SECRET;
});

test("投稿动作产生日志", async () => {
  const response = await createSubmission(
    userPost("http://localhost:3000/api/prompts/api-debug-assistant/submissions", {
      content: "新增：审计日志测试投稿内容。",
      changeNote: "审计日志测试",
    }),
    { params: { slug: "api-debug-assistant" } },
  );
  const payload = await response.json();
  const logs = __getAuditLogFixtureStateForTests() as AuditLogEntry[];
  const log = logs.find((item) => item.action === "submission.created");

  assert.equal(response.status, 201);
  assert.ok(log, "应写入 submission.created 日志");
  assert.equal(log?.targetType, "submission");
  assert.equal(log?.targetId, payload.submission.id);
  assert.deepEqual(log?.payloadJson, {
    promptSlug: "api-debug-assistant",
    baseVersionNo: payload.baseVersion.versionNo,
    candidateVersionNo: payload.candidateVersion.versionNo,
  });
});

test("审核通过与拒绝动作产生日志", async () => {
  const approveResponse = await approveSubmission(
    adminPost("http://localhost:3000/api/admin/submissions/1/approve", {
      reviewComment: "内容完整，可以发布",
    }),
    { params: { id: "1" } },
  );
  const rejectResponse = await rejectSubmission(
    adminPost("http://localhost:3000/api/admin/submissions/2/reject", {
      reviewComment: "缺少边界说明",
    }),
    { params: { id: "2" } },
  );
  const logs = __getAuditLogFixtureStateForTests() as AuditLogEntry[];
  const approvedLog = logs.find((item) => item.action === "submission.approved");
  const rejectedLog = logs.find((item) => item.action === "submission.rejected");

  assert.equal(approveResponse.status, 200);
  assert.equal(rejectResponse.status, 200);
  assert.equal(approvedLog?.targetType, "submission");
  assert.equal(approvedLog?.targetId, 1);
  assert.equal(approvedLog?.payloadJson.promptSlug, "js-code-reviewer");
  assert.equal(approvedLog?.payloadJson.candidateVersionNo, "v0002");
  assert.equal(rejectedLog?.targetType, "submission");
  assert.equal(rejectedLog?.targetId, 2);
  assert.equal(rejectedLog?.payloadJson.promptSlug, "landing-copy-framework");
  assert.equal(rejectedLog?.payloadJson.candidateVersionNo, "v0002");
});

test("点赞动作产生日志", async () => {
  const response = await likePrompt(
    new Request("http://localhost:3000/api/prompts/api-debug-assistant/like", {
      method: "POST",
      headers: {
        cookie: buildAuthCookie({ uid: userEmail, name: "Alice", can_manage: false }),
      },
    }),
    { params: { slug: "api-debug-assistant" } },
  );
  const payload = await response.json();
  const logs = __getAuditLogFixtureStateForTests() as AuditLogEntry[];
  const log = logs.find((item) => item.action === "prompt.liked");

  assert.equal(response.status, 200);
  assert.equal(log?.targetType, "prompt");
  assert.equal(log?.payloadJson.promptSlug, "api-debug-assistant");
  assert.equal(log?.payloadJson.liked, true);
  assert.equal(log?.payloadJson.likesCount, payload.likesCount);
});

test("后台归档、恢复、分类更新、彻底删除动作产生日志", async () => {
  const archiveResponse = await archivePrompt(
    adminPost("http://localhost:3000/api/admin/prompts/api-debug-assistant/archive"),
    { params: { slug: "api-debug-assistant" } },
  );
  assert.equal(archiveResponse.status, 200);

  const restoreResponse = await restorePrompt(
    adminPost("http://localhost:3000/api/admin/prompts/api-debug-assistant/restore"),
    { params: { slug: "api-debug-assistant" } },
  );
  assert.equal(restoreResponse.status, 200);

  const patchResponse = await updatePromptCategories(
    adminPost("http://localhost:3000/api/admin/prompts/api-debug-assistant", {
      categorySlugs: ["programming", "design"],
      primaryCategorySlug: "design",
    }),
    { params: { slug: "api-debug-assistant" } },
  );
  assert.equal(patchResponse.status, 200);

  const previewResponse = await deletePrompt(
    new Request("http://localhost:3000/api/admin/prompts/api-debug-assistant/delete", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: buildAuthCookie({ uid: adminEmail, name: "Admin", can_manage: true }),
      },
      body: JSON.stringify({ confirm: false }),
    }),
    { params: { slug: "api-debug-assistant" } },
  );
  const previewPayload = (await previewResponse.json()) as {
    confirmationToken: string;
  };
  assert.equal(previewResponse.status, 200);

  const deleteResponse = await deletePrompt(
    new Request("http://localhost:3000/api/admin/prompts/api-debug-assistant/delete", {
      method: "DELETE",
      headers: {
        "content-type": "application/json",
        cookie: buildAuthCookie({ uid: adminEmail, name: "Admin", can_manage: true }),
      },
      body: JSON.stringify({
        confirm: true,
        confirmationToken: previewPayload.confirmationToken,
        reason: "fixture audit test",
      }),
    }),
    { params: { slug: "api-debug-assistant" } },
  );
  assert.equal(deleteResponse.status, 200);

  const logs = __getAuditLogFixtureStateForTests() as AuditLogEntry[];
  const archivedLog = logs.find((item) => item.action === "prompt.archived");
  const restoredLog = logs.find((item) => item.action === "prompt.restored");
  const categoriesUpdatedLog = logs.find(
    (item) => item.action === "prompt.categories.updated",
  );
  const deletedLog = logs.find((item) => item.action === "prompt.deleted");

  assert.equal(archivedLog?.targetType, "prompt");
  assert.equal(archivedLog?.payloadJson.promptSlug, "api-debug-assistant");
  assert.equal(archivedLog?.payloadJson.toStatus, "archived");

  assert.equal(restoredLog?.targetType, "prompt");
  assert.equal(restoredLog?.payloadJson.promptSlug, "api-debug-assistant");
  assert.equal(restoredLog?.payloadJson.toStatus, "published");

  assert.equal(categoriesUpdatedLog?.targetType, "prompt");
  assert.equal(categoriesUpdatedLog?.payloadJson.promptSlug, "api-debug-assistant");
  assert.deepEqual(categoriesUpdatedLog?.payloadJson.categorySlugs, ["programming", "design"]);
  assert.equal(categoriesUpdatedLog?.payloadJson.primaryCategorySlug, "design");

  assert.equal(deletedLog?.targetType, "prompt");
  assert.equal(deletedLog?.payloadJson.promptSlug, "api-debug-assistant");
  assert.equal(deletedLog?.payloadJson.reason, "fixture audit test");
});
