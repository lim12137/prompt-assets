import test from "node:test";
import assert from "node:assert/strict";

import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";

type VersionLikeRouteModule = {
  POST: (
    request: Request,
    context: { params: { slug: string; versionNo: string } },
  ) => Promise<Response>;
  DELETE: (
    request: Request,
    context: { params: { slug: string; versionNo: string } },
  ) => Promise<Response>;
};

type VersionLikeResponse = {
  slug: string;
  versionNo: string;
  likesCount: number;
  liked: boolean;
};

type PromptDetail = {
  slug: string;
  currentVersion: {
    versionNo: string;
    likesCount: number;
  };
  versions: Array<{
    versionNo: string;
    likesCount: number;
  }>;
};

const slug = "api-debug-assistant";
const currentVersionNo = "v0002";
const previousVersionNo = "v0001";
const uxResearchPlanSlug = "ux-research-plan";
const uxCandidateVersionNo = "v0003";
const missingVersionNo = "v9999";
const userEmail = "alice@example.com";

async function loadRouteModule(): Promise<VersionLikeRouteModule> {
  return import(
    "../../../apps/web/app/api/prompts/[slug]/versions/[versionNo]/like/route.ts"
  ) as Promise<VersionLikeRouteModule>;
}

function createLikeRequest(
  method: "POST" | "DELETE",
  versionNo: string,
  targetSlug: string = slug,
): Request {
  return new Request(
    `http://localhost:3000/api/prompts/${targetSlug}/versions/${versionNo}/like`,
    {
      method,
      headers: { "x-user-email": userEmail },
    },
  );
}

async function readVersionLikesCount(
  targetSlug: string,
  targetVersionNo: string,
): Promise<number> {
  const response = await getPromptDetail(new Request("http://localhost:3000"), {
    params: { slug: targetSlug },
  });
  const detail = (await response.json()) as PromptDetail;

  assert.equal(response.status, 200);

  const version = detail.versions.find((item) => item.versionNo === targetVersionNo);
  assert.ok(version, `详情中应包含版本 ${targetSlug}@${targetVersionNo}`);
  assert.equal(
    typeof version?.likesCount,
    "number",
    `详情中的版本 ${targetSlug}@${targetVersionNo} 应返回 likesCount`,
  );

  return version.likesCount;
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
});

test("POST /api/prompts/[slug]/versions/[versionNo]/like 首次点赞成功并增加版本 likesCount", async () => {
  const route = await loadRouteModule();
  const beforeCount = await readVersionLikesCount(slug, currentVersionNo);

  const response = await route.POST(createLikeRequest("POST", currentVersionNo), {
    params: { slug, versionNo: currentVersionNo },
  });
  const payload = (await response.json()) as VersionLikeResponse;
  const afterCount = await readVersionLikesCount(slug, currentVersionNo);

  assert.equal(response.status, 200);
  assert.equal(payload.slug, slug);
  assert.equal(payload.versionNo, currentVersionNo);
  assert.equal(payload.liked, true);
  assert.equal(payload.likesCount, beforeCount + 1);
  assert.equal(afterCount, beforeCount + 1);
});

test("POST /api/prompts/[slug]/versions/[versionNo]/like 重复点赞幂等，不重复计数", async () => {
  const route = await loadRouteModule();

  const first = await route.POST(createLikeRequest("POST", currentVersionNo), {
    params: { slug, versionNo: currentVersionNo },
  });
  const firstPayload = (await first.json()) as VersionLikeResponse;

  const second = await route.POST(createLikeRequest("POST", currentVersionNo), {
    params: { slug, versionNo: currentVersionNo },
  });
  const secondPayload = (await second.json()) as VersionLikeResponse;

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(secondPayload.liked, true);
  assert.equal(secondPayload.likesCount, firstPayload.likesCount);
});

test("DELETE /api/prompts/[slug]/versions/[versionNo]/like 取消点赞后计数回退", async () => {
  const route = await loadRouteModule();
  const beforeCount = await readVersionLikesCount(slug, currentVersionNo);

  await route.POST(createLikeRequest("POST", currentVersionNo), {
    params: { slug, versionNo: currentVersionNo },
  });

  const response = await route.DELETE(createLikeRequest("DELETE", currentVersionNo), {
    params: { slug, versionNo: currentVersionNo },
  });
  const payload = (await response.json()) as VersionLikeResponse;
  const afterCount = await readVersionLikesCount(slug, currentVersionNo);

  assert.equal(response.status, 200);
  assert.equal(payload.liked, false);
  assert.equal(payload.likesCount, beforeCount);
  assert.equal(afterCount, beforeCount);
});

test("不同版本的点赞计数互不影响", async () => {
  const route = await loadRouteModule();
  const beforeCurrent = await readVersionLikesCount(slug, currentVersionNo);
  const beforePrevious = await readVersionLikesCount(slug, previousVersionNo);

  const response = await route.POST(createLikeRequest("POST", currentVersionNo), {
    params: { slug, versionNo: currentVersionNo },
  });
  const payload = (await response.json()) as VersionLikeResponse;
  const afterCurrent = await readVersionLikesCount(slug, currentVersionNo);
  const afterPrevious = await readVersionLikesCount(slug, previousVersionNo);

  assert.equal(response.status, 200);
  assert.equal(payload.versionNo, currentVersionNo);
  assert.equal(afterCurrent, beforeCurrent + 1);
  assert.equal(afterPrevious, beforePrevious);
});

test("POST /api/prompts/[slug]/versions/[versionNo]/like 在 versionNo 不存在时返回 404", async () => {
  const route = await loadRouteModule();

  const response = await route.POST(createLikeRequest("POST", missingVersionNo), {
    params: { slug, versionNo: missingVersionNo },
  });
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 404);
  assert.equal(typeof payload.error, "string");
});

test("POST /api/prompts/ux-research-plan/versions/v0003/like 候选版本可点赞", async () => {
  const route = await loadRouteModule();

  const response = await route.POST(
    createLikeRequest("POST", uxCandidateVersionNo, uxResearchPlanSlug),
    {
      params: { slug: uxResearchPlanSlug, versionNo: uxCandidateVersionNo },
    },
  );
  const payload = (await response.json()) as VersionLikeResponse | { error: string };

  assert.equal(response.status, 200);
  assert.equal((payload as VersionLikeResponse).slug, uxResearchPlanSlug);
  assert.equal((payload as VersionLikeResponse).versionNo, uxCandidateVersionNo);
  assert.equal((payload as VersionLikeResponse).liked, true);
});
