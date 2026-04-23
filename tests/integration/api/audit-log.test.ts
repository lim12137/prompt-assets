import test from "node:test";
import assert from "node:assert/strict";

import { POST as approveSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/approve/route.ts";
import { POST as rejectSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/reject/route.ts";
import { POST as likePrompt } from "../../../apps/web/app/api/prompts/[slug]/like/route.ts";
import { POST as createSubmission } from "../../../apps/web/app/api/prompts/[slug]/submissions/route.ts";
import {
  __getAuditLogFixtureStateForTests,
  __resetPromptLikeFixtureStateForTests,
} from "../../../apps/web/lib/api/prompt-repository.ts";

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
      "x-user-email": userEmail,
    },
    body: JSON.stringify(body),
  });
}

function adminPost(url: string, body: Record<string, unknown> = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": adminEmail,
      "x-user-role": "admin",
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
        "x-user-email": userEmail,
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
