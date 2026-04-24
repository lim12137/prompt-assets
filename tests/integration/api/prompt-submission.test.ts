import test from "node:test";
import assert from "node:assert/strict";

import { nextVersionNo } from "../../../packages/domain/src/versioning.ts";
import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import { POST } from "../../../apps/web/app/api/prompts/[slug]/submissions/route.ts";
import { POST as approveSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/approve/route.ts";
import {
  __resetPromptLikeFixtureStateForTests,
  createPromptSubmission,
  listPendingSubmissions,
} from "../../../apps/web/lib/api/prompt-repository.ts";

type PromptDetail = {
  currentVersion: {
    versionNo: string;
  };
  versions: Array<{
    versionNo: string;
    status: "approved" | "pending" | "rejected";
    content?: string;
  }>;
};

type SubmissionResponse = {
  promptSlug: string;
  baseVersion: {
    versionNo: string;
  };
  candidateVersion: {
    versionNo: string;
    sourceType: string;
    candidateNo: string;
  };
  submission: {
    id: number;
    status: "pending" | "approved" | "rejected";
    submitter: string;
    revisionIndex: number;
  };
  currentVersion: {
    versionNo: string;
  };
};

function maxVersionNo(detail: PromptDetail): string {
  let maxNo = 0;
  for (const version of detail.versions) {
    const no = Number(version.versionNo.replace(/^v/i, ""));
    if (Number.isFinite(no) && no > maxNo) {
      maxNo = no;
    }
  }
  return `v${String(maxNo).padStart(4, "0")}`;
}

const slug = "api-debug-assistant";
const userEmail = "alice@example.com";

function createSubmissionRequest(
  targetSlug: string,
  email: string,
  content: string,
): Request {
  return new Request(`http://localhost:3000/api/prompts/${targetSlug}/submissions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": email,
    },
    body: JSON.stringify({
      content,
      changeNote: "candidate metadata test",
    }),
  });
}

function createAdminApproveRequest(submissionId: string): Request {
  return new Request(`http://localhost:3000/api/admin/submissions/${submissionId}/approve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": "admin@example.com",
      "x-user-role": "admin",
    },
    body: JSON.stringify({ reviewComment: "切换官方基线" }),
  });
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
});

test("POST /api/prompts/[slug]/submissions 创建 pending submission 且不切换当前版本", async () => {
  const beforeResponse = await getPromptDetail(new Request("http://localhost:3000"), {
    params: { slug },
  });
  const before = (await beforeResponse.json()) as PromptDetail;
  const expectedCandidateVersionNo = nextVersionNo(maxVersionNo(before));

  const response = await POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/submissions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-email": userEmail,
      },
      body: JSON.stringify({
        content: "新增：输出接口重放步骤、根因树和回滚策略。",
        changeNote: "补充提交版本用于审核",
      }),
    }),
    { params: { slug } },
  );
  const payload = (await response.json()) as SubmissionResponse;

  assert.equal(response.status, 201);
  assert.equal(payload.promptSlug, slug);
  assert.equal(payload.baseVersion.versionNo, before.currentVersion.versionNo);
  assert.equal(payload.candidateVersion.versionNo, expectedCandidateVersionNo);
  assert.equal(payload.candidateVersion.sourceType, "submission");
  assert.equal(
    payload.candidateVersion.candidateNo,
    `${before.currentVersion.versionNo}-cand-alice-1`,
  );
  assert.equal(typeof payload.submission.id, "number");
  assert.equal(payload.submission.status, "pending");
  assert.equal(payload.submission.submitter, userEmail);
  assert.equal(payload.submission.revisionIndex, 1);
  assert.equal(payload.currentVersion.versionNo, before.currentVersion.versionNo);

  const afterResponse = await getPromptDetail(new Request("http://localhost:3000"), {
    params: { slug },
  });
  const after = (await afterResponse.json()) as PromptDetail;
  const candidate = after.versions.find(
    (item) => item.versionNo === expectedCandidateVersionNo,
  );

  assert.equal(after.currentVersion.versionNo, before.currentVersion.versionNo);
  assert.ok(candidate, "详情中应包含新生成的 candidate version");
  assert.equal(candidate?.status, "pending");
  assert.equal(typeof candidate?.content, "string");
});

test("POST /api/prompts/[slug]/submissions 在 content 为空时返回 400", async () => {
  const response = await POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/submissions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-email": userEmail,
      },
      body: JSON.stringify({
        content: "   ",
        changeNote: "empty content",
      }),
    }),
    { params: { slug } },
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 400);
  assert.equal(typeof payload.error, "string");
});

test("POST /api/prompts/[slug]/submissions 在 slug 不存在时返回 404", async () => {
  const response = await POST(
    new Request("http://localhost:3000/api/prompts/not-exists/submissions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-email": userEmail,
      },
      body: JSON.stringify({
        content: "这是一个不存在 slug 的投稿",
        changeNote: "should fail",
      }),
    }),
    { params: { slug: "not-exists" } },
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 404);
  assert.equal(typeof payload.error, "string");
});

test("同一用户在同一基线下多次投稿 revisionIndex 递增", async () => {
  const firstResponse = await POST(
    createSubmissionRequest(slug, "alice@example.com", "first"),
    { params: { slug } },
  );
  const first = (await firstResponse.json()) as SubmissionResponse;

  const secondResponse = await POST(
    createSubmissionRequest(slug, "alice@example.com", "second"),
    { params: { slug } },
  );
  const second = (await secondResponse.json()) as SubmissionResponse;

  assert.equal(firstResponse.status, 201);
  assert.equal(secondResponse.status, 201);
  assert.equal(first.submission.revisionIndex, 1);
  assert.equal(second.submission.revisionIndex, 2);
  assert.equal(first.candidateVersion.candidateNo.endsWith("-1"), true);
  assert.equal(second.candidateVersion.candidateNo.endsWith("-2"), true);
});

test("不同用户在同一基线下 revisionIndex 相互隔离", async () => {
  const aliceResponse = await POST(
    createSubmissionRequest(slug, "alice@example.com", "alice"),
    { params: { slug } },
  );
  const alice = (await aliceResponse.json()) as SubmissionResponse;

  const bobResponse = await POST(
    createSubmissionRequest(slug, "bob@example.com", "bob"),
    { params: { slug } },
  );
  const bob = (await bobResponse.json()) as SubmissionResponse;

  assert.equal(aliceResponse.status, 201);
  assert.equal(bobResponse.status, 201);
  assert.equal(alice.submission.revisionIndex, 1);
  assert.equal(bob.submission.revisionIndex, 1);
  assert.equal(alice.candidateVersion.candidateNo.includes("-alice"), true);
  assert.equal(bob.candidateVersion.candidateNo.includes("-bob"), true);
});

test("官方基线切换后同用户 revisionIndex 从 1 重新计数", async () => {
  const approveResponse = await approveSubmission(createAdminApproveRequest("1"), {
    params: { id: "1" },
  });
  assert.equal(approveResponse.status, 200);

  const response = await POST(
    createSubmissionRequest("js-code-reviewer", "alice@example.com", "new baseline"),
    { params: { slug: "js-code-reviewer" } },
  );
  const payload = (await response.json()) as SubmissionResponse;

  assert.equal(response.status, 201);
  assert.equal(payload.baseVersion.versionNo, "v0002");
  assert.equal(payload.submission.revisionIndex, 1);
  assert.equal(payload.candidateVersion.candidateNo.startsWith("v0002-cand-"), true);
  assert.equal(payload.candidateVersion.candidateNo.endsWith("-1"), true);
});

test("POST /api/prompts/[slug]/submissions 对非 ASCII submitter 不应 500", async () => {
  const payload = (await createPromptSubmission(slug, {
    userEmail: "张三@example.com",
    content: "unicode submitter",
    changeNote: "unicode",
  })) as SubmissionResponse;

  assert.ok(payload);
  assert.equal(payload.submission.submitter, "张三@example.com");
  assert.equal(payload.submission.revisionIndex, 1);
  assert.equal(payload.candidateVersion.candidateNo.startsWith("v0002-cand-"), true);
});

test("listPendingSubmissions 读取模型返回稳定候选号元数据", async () => {
  await POST(createSubmissionRequest(slug, "alice@example.com", "one"), {
    params: { slug },
  });
  await POST(createSubmissionRequest(slug, "alice@example.com", "two"), {
    params: { slug },
  });

  const pending = await listPendingSubmissions();
  const matched = pending
    .filter(
      (item) =>
        item.promptSlug === slug && item.submitterEmail === "alice@example.com",
    )
    .sort((a, b) => a.revisionIndex - b.revisionIndex);

  assert.equal(matched.length, 2);
  assert.equal(matched[0].revisionIndex, 1);
  assert.equal(matched[1].revisionIndex, 2);
  assert.equal(matched[0].candidateNo.endsWith("-1"), true);
  assert.equal(matched[1].candidateNo.endsWith("-2"), true);
});
