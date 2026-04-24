import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../../apps/web/app/api/admin/submissions/route.ts";
import { POST as approveSubmission } from "../../../apps/web/app/api/admin/submissions/[id]/approve/route.ts";
import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";

type AdminSubmissionItem = {
  id: number;
  promptSlug: string;
  promptTitle: string;
  baseVersionNo: string;
  candidateVersionNo: string;
  submitterEmail: string;
  status: "pending" | "approved" | "rejected";
};

type AdminSubmissionListResponse = {
  submissions: AdminSubmissionItem[];
};

function adminGetRequest(): Request {
  return new Request("http://localhost:3000/api/admin/submissions", {
    method: "GET",
    headers: {
      "x-user-email": "admin@example.com",
      "x-user-role": "admin",
    },
  });
}

function userGetRequest(): Request {
  return new Request("http://localhost:3000/api/admin/submissions", {
    method: "GET",
    headers: {
      "x-user-email": "alice@example.com",
      "x-user-role": "user",
    },
  });
}

function adminApproveRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/admin/submissions/${id}/approve`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": "admin@example.com",
      "x-user-role": "admin",
    },
    body: JSON.stringify({
      reviewComment: "审核通过",
    }),
  });
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
});

test("GET /api/admin/submissions 默认返回 pending 列表", async () => {
  const response = await GET(adminGetRequest());
  const payload = (await response.json()) as AdminSubmissionListResponse;

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.submissions));
  assert.ok(payload.submissions.length >= 2);
  assert.equal(
    payload.submissions.every((item) => item.status === "pending"),
    true,
  );

  const first = payload.submissions[0];
  assert.equal(typeof first.id, "number");
  assert.equal(typeof first.promptSlug, "string");
  assert.equal(typeof first.promptTitle, "string");
  assert.equal(typeof first.baseVersionNo, "string");
  assert.equal(typeof first.candidateVersionNo, "string");
  assert.equal(typeof first.submitterEmail, "string");
});

test("GET /api/admin/submissions 在审核后能反映最新 pending 列表", async () => {
  await approveSubmission(adminApproveRequest("1"), { params: { id: "1" } });

  const response = await GET(adminGetRequest());
  const payload = (await response.json()) as AdminSubmissionListResponse;

  assert.equal(response.status, 200);
  assert.equal(payload.submissions.length, 1);
  assert.equal(payload.submissions[0].id, 2);
  assert.equal(payload.submissions[0].status, "pending");
});

test("GET /api/admin/submissions 禁止非 admin 访问并返回可机读错误码", async () => {
  const response = await GET(userGetRequest());
  const payload = (await response.json()) as { error: string; code: string };

  assert.equal(response.status, 403);
  assert.equal(typeof payload.error, "string");
  assert.equal(payload.code, "admin_role_required");
});
