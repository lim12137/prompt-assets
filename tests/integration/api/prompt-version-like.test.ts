import test from "node:test";
import assert from "node:assert/strict";

import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import {
  __getPromptVersionLikeTargetLookupCountForTests,
  __resetPromptLikeFixtureStateForTests,
  __resetPromptVersionLikeTargetLookupCountForTests,
} from "../../../apps/web/lib/api/prompt-repository.ts";
import { buildAuthCookie } from "./_auth-test-helpers.ts";
import { isPgReachable, withPgClient } from "../../../packages/db/src/client.ts";
import { seedDatabase } from "../../../packages/db/src/seed.ts";

type VersionLikeRouteModule = {
  POST: (
    request: Request,
    context: { params: Promise<{ slug: string; versionNo: string }> },
  ) => Promise<Response>;
  DELETE: (
    request: Request,
    context: { params: Promise<{ slug: string; versionNo: string }> },
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
const dailyInteractionInfraLockKey = 2026042901;
const likeLookupCountLockKey = 2026051401;
const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";

async function loadRouteModule(): Promise<VersionLikeRouteModule> {
  return import(
    "../../../apps/web/app/api/prompts/[slug]/versions/[versionNo]/like/route.ts"
  ) as Promise<VersionLikeRouteModule>;
}

function createLikeRequest(
  method: "POST" | "DELETE",
  versionNo: string,
  targetSlug: string = slug,
  input?: { withAuth?: boolean; forgedHeaderEmail?: string },
): Request {
  const withAuth = input?.withAuth ?? true;
  const forgedHeaderEmail = input?.forgedHeaderEmail;
  return new Request(
    `http://localhost:3000/api/prompts/${targetSlug}/versions/${versionNo}/like`,
    {
      method,
      headers: {
        ...(withAuth
          ? {
              cookie: buildAuthCookie({
                uid: userEmail,
                name: "Alice",
                can_manage: false,
              }),
            }
          : {}),
        ...(forgedHeaderEmail ? { "x-user-email": forgedHeaderEmail } : {}),
      },
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
  process.env.LOGIN_TOKEN_SECRET = "test-secret";
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
  delete process.env.LOGIN_TOKEN_SECRET;
});

test("POST /api/prompts/[slug]/versions/[versionNo]/like 首次点赞成功并增加版本 likesCount", async () => {
  const route = await loadRouteModule();
  const beforeCount = await readVersionLikesCount(slug, currentVersionNo);

  const response = await route.POST(createLikeRequest("POST", currentVersionNo), {
    params: Promise.resolve({ slug, versionNo: currentVersionNo }),
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

test("POST /api/prompts/[slug]/versions/[versionNo]/like 同 IP 同日重复点赞返回 429", async () => {
  const route = await loadRouteModule();

  const first = await route.POST(new Request(
    `http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`,
    {
      method: "POST",
      headers: {
        cookie: buildAuthCookie({
          uid: userEmail,
          name: "Alice",
          can_manage: false,
        }),
        "x-forwarded-for": "198.51.100.31",
      },
    },
  ), {
    params: Promise.resolve({ slug, versionNo: currentVersionNo }),
  });

  const second = await route.POST(new Request(
    `http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`,
    {
      method: "POST",
      headers: {
        cookie: buildAuthCookie({
          uid: userEmail,
          name: "Alice",
          can_manage: false,
        }),
        "x-forwarded-for": "198.51.100.31",
      },
    },
  ), {
    params: Promise.resolve({ slug, versionNo: currentVersionNo }),
  });
  const secondPayload = (await second.json()) as { error?: string };

  assert.equal(first.status, 200);
  assert.equal(second.status, 429);
  assert.match(String(secondPayload.error ?? ""), /今日该卡片已操作|今天已经对该卡片操作过/);
});

test("DELETE /api/prompts/[slug]/versions/[versionNo]/like 取消点赞后计数回退", async () => {
  const route = await loadRouteModule();
  const beforeCount = await readVersionLikesCount(slug, currentVersionNo);

  await route.POST(createLikeRequest("POST", currentVersionNo), {
    params: Promise.resolve({ slug, versionNo: currentVersionNo }),
  });

  const response = await route.DELETE(createLikeRequest("DELETE", currentVersionNo), {
    params: Promise.resolve({ slug, versionNo: currentVersionNo }),
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
    params: Promise.resolve({ slug, versionNo: currentVersionNo }),
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
    params: Promise.resolve({ slug, versionNo: missingVersionNo }),
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
      params: Promise.resolve({ slug: uxResearchPlanSlug, versionNo: uxCandidateVersionNo }),
    },
  );
  const payload = (await response.json()) as VersionLikeResponse | { error: string };

  assert.equal(response.status, 200);
  assert.equal((payload as VersionLikeResponse).slug, uxResearchPlanSlug);
  assert.equal((payload as VersionLikeResponse).versionNo, uxCandidateVersionNo);
  assert.equal((payload as VersionLikeResponse).liked, true);
});

test("POST /versions/[versionNo]/like 未登录也可点赞，伪造 x-user-email 不影响", async () => {
  const route = await loadRouteModule();
  const response = await route.POST(
    createLikeRequest("POST", currentVersionNo, slug, {
      withAuth: false,
      forgedHeaderEmail: "forged@example.com",
    }),
  { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  const payload = (await response.json()) as VersionLikeResponse;
  assert.equal(response.status, 200);
  assert.equal(payload.slug, slug);
  assert.equal(payload.versionNo, currentVersionNo);
  assert.equal(payload.liked, true);
});

test("DELETE /versions/[versionNo]/like 未登录同 IP 可取消自己的匿名点赞", async () => {
  const route = await loadRouteModule();
  const requestIp = "203.0.113.88";
  const beforeCount = await readVersionLikesCount(slug, currentVersionNo);

  const likeResponse = await route.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "POST",
      headers: {
        "x-forwarded-for": requestIp,
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  assert.equal(likeResponse.status, 200);

  const unlikeResponse = await route.DELETE(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "DELETE",
      headers: {
        "x-forwarded-for": requestIp,
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  const payload = (await unlikeResponse.json()) as VersionLikeResponse;
  const afterCount = await readVersionLikesCount(slug, currentVersionNo);

  assert.equal(unlikeResponse.status, 200);
  assert.equal(payload.slug, slug);
  assert.equal(payload.versionNo, currentVersionNo);
  assert.equal(payload.liked, false);
  assert.equal(payload.likesCount, beforeCount);
  assert.equal(afterCount, beforeCount);
});

test("POST /versions/[versionNo]/like 未登录同 IP 同日同卡片第二次返回 429", async () => {
  const route = await loadRouteModule();
  const first = await route.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.77",
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  assert.equal(first.status, 200);

  const second = await route.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "POST",
      headers: {
        "x-forwarded-for": "203.0.113.77",
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  const payload = (await second.json()) as { error?: string };
  assert.equal(second.status, 429);
  assert.match(String(payload.error ?? ""), /今日该卡片已操作|今天已经对该卡片操作过/);
});

test("POST /like 同 IP 同卡片同日重复点赞返回 429", async () => {
  const route = await loadRouteModule();
  const first = await route.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "POST",
      headers: {
        cookie: buildAuthCookie({ uid: "u1@example.com", name: "u1", can_manage: false }),
        "x-forwarded-for": "203.0.113.10",
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  assert.equal(first.status, 200);

  const second = await route.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "POST",
      headers: {
        cookie: buildAuthCookie({ uid: "u2@example.com", name: "u2", can_manage: false }),
        "x-forwarded-for": "203.0.113.10",
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  const payload = (await second.json()) as { error?: string };
  assert.equal(second.status, 429);
  assert.match(String(payload.error ?? ""), /今日该卡片已操作|今天已经对该卡片操作过/);
});

test("POST /like 不同 IP 同卡片同日可分别点赞", async () => {
  const route = await loadRouteModule();
  const first = await route.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "POST",
      headers: {
        cookie: buildAuthCookie({ uid: "u1@example.com", name: "u1", can_manage: false }),
        "x-forwarded-for": "203.0.113.11",
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  const second = await route.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
      method: "POST",
      headers: {
        cookie: buildAuthCookie({ uid: "u2@example.com", name: "u2", can_manage: false }),
        "x-forwarded-for": "203.0.113.12",
      },
    }),
    { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
  );
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
});

test("POST /like 在缺少日频限流基础设施时应 fail-closed 返回 500", async (t) => {
  process.env.DATABASE_URL = testDbUrl;
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
  process.env.LOGIN_TOKEN_SECRET = "test-secret";
  __resetPromptLikeFixtureStateForTests();

  if (!(await isPgReachable(testDbUrl))) {
    t.skip(`测试库不可达，跳过: ${testDbUrl}`);
    return;
  }
  await withPgClient(testDbUrl, async (lockClient) => {
    await lockClient.query("SELECT pg_advisory_lock($1);", [dailyInteractionInfraLockKey]);
    try {
      await seedDatabase(testDbUrl, { reset: true });

      await withPgClient(testDbUrl, async (client) => {
        await client.query(
          "ALTER TABLE IF EXISTS prompt_version_daily_interactions RENAME TO prompt_version_daily_interactions_disabled_for_test;",
        );
      });

      const route = await loadRouteModule();
      const response = await route.POST(
        new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
          method: "POST",
          headers: {
            cookie: buildAuthCookie({ uid: "u1@example.com", name: "u1", can_manage: false }),
            "x-forwarded-for": "203.0.113.31",
          },
        }),
        { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
      );
      const payload = (await response.json()) as { error?: string; code?: string };
      assert.equal(response.status, 500);
      assert.equal(payload.code, "missing_infrastructure");
      assert.equal(payload.error, "评分点赞限流基础设施未就绪");
    } finally {
      await withPgClient(testDbUrl, async (client) => {
        await client.query(
          "ALTER TABLE IF EXISTS prompt_version_daily_interactions_disabled_for_test RENAME TO prompt_version_daily_interactions;",
        );
      });
      await seedDatabase(testDbUrl, { reset: true });
      await lockClient.query("SELECT pg_advisory_unlock($1);", [dailyInteractionInfraLockKey]);
    }
  });
});

test("POST /like 单次请求在 DB 路径只定位一次目标版本", async (t) => {
  process.env.DATABASE_URL = testDbUrl;
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
  process.env.LOGIN_TOKEN_SECRET = "test-secret";
  __resetPromptLikeFixtureStateForTests();
  __resetPromptVersionLikeTargetLookupCountForTests();

  if (!(await isPgReachable(testDbUrl))) {
    t.skip(`测试库不可达，跳过: ${testDbUrl}`);
    return;
  }

  await withPgClient(testDbUrl, async (lockClient) => {
    await lockClient.query("SELECT pg_advisory_lock($1);", [likeLookupCountLockKey]);
    try {
      await seedDatabase(testDbUrl, { reset: true });
      __resetPromptVersionLikeTargetLookupCountForTests();

      const route = await loadRouteModule();
      const response = await route.POST(
        new Request(`http://localhost:3000/api/prompts/${slug}/versions/${currentVersionNo}/like`, {
          method: "POST",
          headers: {
            cookie: buildAuthCookie({ uid: "u1@example.com", name: "u1", can_manage: false }),
            "x-forwarded-for": "203.0.113.141",
          },
        }),
        { params: Promise.resolve({ slug, versionNo: currentVersionNo }) },
      );
      const payload = (await response.json()) as VersionLikeResponse;

      assert.equal(response.status, 200);
      assert.equal(payload.slug, slug);
      assert.equal(payload.versionNo, currentVersionNo);
      assert.equal(payload.liked, true);
      assert.equal(__getPromptVersionLikeTargetLookupCountForTests(), 1);
    } finally {
      await seedDatabase(testDbUrl, { reset: true });
      await lockClient.query("SELECT pg_advisory_unlock($1);", [likeLookupCountLockKey]);
    }
  });
});

