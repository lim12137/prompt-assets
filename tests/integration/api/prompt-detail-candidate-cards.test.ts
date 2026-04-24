import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import {
  __resetPromptLikeFixtureStateForTests,
  createPromptSubmission,
} from "../../../apps/web/lib/api/prompt-repository.ts";

type PromptDetail = {
  slug: string;
  currentVersion: {
    versionNo: string;
  };
  versions: Array<{
    versionNo: string;
    sourceType: string;
    status: "approved" | "pending" | "rejected";
    submittedBy?: string;
  }>;
};

function versionNoToInt(versionNo: string): number {
  return Number(String(versionNo).replace(/^v/i, ""));
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
});

test("GET /api/prompts/[slug] 候选版本包含提交人，并可按员工聚合最新一张", async () => {
  const slug = "api-debug-assistant";

  await createPromptSubmission(slug, {
    userEmail: "alice@example.com",
    content: "alice v1",
    changeNote: "alice first",
  });
  const aliceSecond = await createPromptSubmission(slug, {
    userEmail: "alice@example.com",
    content: "alice v2",
    changeNote: "alice second",
  });
  await createPromptSubmission(slug, {
    userEmail: "bob@example.com",
    content: "bob v1",
    changeNote: "bob first",
  });

  const response = await GET(new Request("http://localhost:3000"), {
    params: { slug },
  });
  const payload = (await response.json()) as PromptDetail;

  assert.equal(response.status, 200);
  const pendingCandidates = payload.versions.filter(
    (item) => item.sourceType === "submission" && item.status === "pending",
  );
  assert.ok(pendingCandidates.length >= 3);
  assert.equal(
    pendingCandidates.every((item) => typeof item.submittedBy === "string" && item.submittedBy.includes("@")),
    true,
  );

  const bySubmitter = new Map<string, { versionNo: string }>();
  for (const item of pendingCandidates) {
    const key = String(item.submittedBy);
    const current = bySubmitter.get(key);
    if (!current || versionNoToInt(item.versionNo) > versionNoToInt(current.versionNo)) {
      bySubmitter.set(key, { versionNo: item.versionNo });
    }
  }

  assert.ok(bySubmitter.has("alice@example.com"));
  assert.ok(bySubmitter.has("bob@example.com"));
  const aliceVersionNo = bySubmitter.get("alice@example.com")?.versionNo ?? "";
  const expectedAliceVersionNo = aliceSecond?.candidateVersion.versionNo ?? "";
  assert.equal(aliceVersionNo, expectedAliceVersionNo);
});
