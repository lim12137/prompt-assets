import test from "node:test";
import assert from "node:assert/strict";

import { nextVersionNo } from "../../../packages/domain/src/versioning.ts";
import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import { POST } from "../../../apps/web/app/api/prompts/[slug]/submissions/route.ts";
import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";

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
  };
  submission: {
    status: "pending" | "approved" | "rejected";
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
  assert.equal(payload.submission.status, "pending");
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
