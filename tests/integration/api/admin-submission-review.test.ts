import test from "node:test";
import assert from "node:assert/strict";

import { POST as approveSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/approve/route.ts";
import { POST as rejectSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/reject/route.ts";
import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";

type PromptDetail = {
  currentVersion: {
    versionNo: string;
  };
  versions: Array<{
    versionNo: string;
    status: "approved" | "pending" | "rejected";
  }>;
};

type ReviewResponse = {
  submission: {
    id: number;
    status: "pending" | "approved" | "rejected";
    reviewComment?: string;
    reviewedByEmail?: string;
  };
  prompt: {
    slug: string;
    currentVersion: {
      versionNo: string;
    };
  };
  candidateVersion: {
    versionNo: string;
  };
};

const adminEmail = "admin@example.com";

function adminRequest(url: string, body: Record<string, unknown> = {}): Request {
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

function userRequest(url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": "alice@example.com",
      "x-user-role": "user",
    },
    body: JSON.stringify({ reviewComment: "普通用户不能审核" }),
  });
}

async function readPromptDetail(slug: string): Promise<PromptDetail> {
  const response = await getPromptDetail(new Request("http://localhost:3000"), {
    params: { slug },
  });
  return (await response.json()) as PromptDetail;
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
});

test("POST /api/admin/submissions/[id]/approve 成功后切换当前版本", async () => {
  const before = await readPromptDetail("js-code-reviewer");

  const response = await approveSubmission(
    adminRequest("http://localhost:3000/api/admin/submissions/1/approve", {
      reviewComment: "内容完整，可以发布",
    }),
    { params: { id: "1" } },
  );
  const payload = (await response.json()) as ReviewResponse;
  const after = await readPromptDetail("js-code-reviewer");

  assert.equal(response.status, 200);
  assert.equal(payload.submission.id, 1);
  assert.equal(payload.submission.status, "approved");
  assert.equal(payload.submission.reviewComment, "内容完整，可以发布");
  assert.equal(payload.submission.reviewedByEmail, adminEmail);
  assert.equal(payload.prompt.slug, "js-code-reviewer");
  assert.equal(payload.candidateVersion.versionNo, "v0002");
  assert.equal(payload.prompt.currentVersion.versionNo, "v0002");
  assert.equal(before.currentVersion.versionNo, "v0001");
  assert.equal(after.currentVersion.versionNo, "v0002");
  assert.equal(
    after.versions.find((version) => version.versionNo === "v0002")?.status,
    "approved",
  );
});

test("POST /api/admin/submissions/[id]/reject 成功后记录审核意见且不切换当前版本", async () => {
  const before = await readPromptDetail("landing-copy-framework");

  const response = await rejectSubmission(
    adminRequest("http://localhost:3000/api/admin/submissions/2/reject", {
      reviewComment: "缺少使用边界说明，暂不发布",
    }),
    { params: { id: "2" } },
  );
  const payload = (await response.json()) as ReviewResponse;
  const after = await readPromptDetail("landing-copy-framework");

  assert.equal(response.status, 200);
  assert.equal(payload.submission.id, 2);
  assert.equal(payload.submission.status, "rejected");
  assert.equal(payload.submission.reviewComment, "缺少使用边界说明，暂不发布");
  assert.equal(payload.prompt.currentVersion.versionNo, before.currentVersion.versionNo);
  assert.equal(after.currentVersion.versionNo, before.currentVersion.versionNo);
  assert.equal(
    after.versions.find((version) => version.versionNo === "v0002")?.status,
    "rejected",
  );
});

test("POST /api/admin/submissions/[id]/approve 对非 pending submission 返回 409", async () => {
  await approveSubmission(
    adminRequest("http://localhost:3000/api/admin/submissions/1/approve", {
      reviewComment: "首次通过",
    }),
    { params: { id: "1" } },
  );

  const response = await approveSubmission(
    adminRequest("http://localhost:3000/api/admin/submissions/1/approve", {
      reviewComment: "重复审核",
    }),
    { params: { id: "1" } },
  );
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 409);
  assert.equal(typeof payload.error, "string");
  assert.equal(payload.code, "submission_not_pending");
});

test("POST /api/admin/submissions/[id]/reject 禁止非 admin 审核", async () => {
  const before = await readPromptDetail("landing-copy-framework");

  const response = await rejectSubmission(
    userRequest("http://localhost:3000/api/admin/submissions/2/reject"),
    { params: { id: "2" } },
  );
  const payload = (await response.json()) as { error: string; code: string };
  const after = await readPromptDetail("landing-copy-framework");

  assert.equal(response.status, 403);
  assert.equal(typeof payload.error, "string");
  assert.equal(payload.code, "admin_role_required");
  assert.equal(after.currentVersion.versionNo, before.currentVersion.versionNo);
  assert.equal(
    after.versions.find((version) => version.versionNo === "v0002")?.status,
    "pending",
  );
});

test("POST /api/admin/submissions/[id]/approve submission 不存在时返回 404 且带错误码", async () => {
  const response = await approveSubmission(
    adminRequest("http://localhost:3000/api/admin/submissions/999/approve", {
      reviewComment: "不存在的提审单",
    }),
    { params: { id: "999" } },
  );
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 404);
  assert.equal(typeof payload.error, "string");
  assert.equal(payload.code, "submission_not_found");
});
