import test from "node:test";
import assert from "node:assert/strict";

import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";
import { buildAuthCookie } from "./_auth-test-helpers.ts";
import { isPgReachable, withPgClient } from "../../../packages/db/src/client.ts";
import { seedDatabase } from "../../../packages/db/src/seed.ts";

type ScoreRouteModule = {
  POST: (
    request: Request,
    context: { params: Promise<{ slug: string; versionNo: string }> },
  ) => Promise<Response>;
};

type ScoreStatsRouteModule = {
  GET: (
    request: Request,
    context: { params: Promise<{ slug: string; versionNo: string }> },
  ) => Promise<Response>;
};

type ScoreWriteResponse = {
  slug: string;
  versionNo: string;
  scene: string;
  traceId: string;
  score: number;
};

type ScoreStatsResponse = {
  slug: string;
  versionNo: string;
  scene?: string;
  totalScores: number;
  averageScore: number;
  lowScoreRate: number;
  distribution: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5": number;
  };
};

const slug = "ux-research-plan";
const versionNo = "v0003";
const missingVersionNo = "v9999";
const dailyInteractionInfraLockKey = 2026042901;
const testDbUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test";

async function loadScoreRouteModule(): Promise<ScoreRouteModule> {
  return import(
    "../../../apps/web/app/api/prompts/[slug]/versions/[versionNo]/score/route.ts"
  ) as Promise<ScoreRouteModule>;
}

async function loadScoreStatsRouteModule(): Promise<ScoreStatsRouteModule> {
  return import(
    "../../../apps/web/app/api/prompts/[slug]/versions/[versionNo]/score-stats/route.ts"
  ) as Promise<ScoreStatsRouteModule>;
}

function createPostScoreRequest(input: {
  score: number;
  scene?: string;
  traceId?: string;
  userEmail?: string;
  ip?: string;
}): Request {
  return new Request(
    `http://localhost:3000/api/prompts/${slug}/versions/${versionNo}/score`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: buildAuthCookie({
          uid: input.userEmail ?? "alice@example.com",
          name: input.userEmail ?? "alice@example.com",
          can_manage: false,
        }),
        ...(input.ip ? { "x-forwarded-for": input.ip } : {}),
      },
      body: JSON.stringify({
        score: input.score,
        scene: input.scene,
        traceId: input.traceId,
      }),
    },
  );
}

async function readScoreStats(
  route: ScoreStatsRouteModule,
  input?: {
    targetSlug?: string;
    targetVersionNo?: string;
    scene?: string;
  },
): Promise<{ response: Response; payload: ScoreStatsResponse | { error: string } }> {
  const targetSlug = input?.targetSlug ?? slug;
  const targetVersionNo = input?.targetVersionNo ?? versionNo;
  const search = input?.scene
    ? `?scene=${encodeURIComponent(input.scene)}`
    : "";

  const response = await route.GET(
    new Request(
      `http://localhost:3000/api/prompts/${targetSlug}/versions/${targetVersionNo}/score-stats${search}`,
    ),
    { params: Promise.resolve({ slug: targetSlug, versionNo: targetVersionNo }) },
  );
  const payload = (await response.json()) as ScoreStatsResponse | { error: string };
  return { response, payload };
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

test("POST /api/prompts/[slug]/versions/[versionNo]/score 写入合法评分", async () => {
  const scoreRoute = await loadScoreRouteModule();

  const response = await scoreRoute.POST(
    createPostScoreRequest({ score: 5, scene: "detail_page", traceId: "trace-ok-1" }),
    { params: Promise.resolve({ slug, versionNo }) },
  );
  const payload = (await response.json()) as ScoreWriteResponse | { error: string };

  assert.equal(response.status, 200);
  assert.equal((payload as ScoreWriteResponse).slug, slug);
  assert.equal((payload as ScoreWriteResponse).versionNo, versionNo);
  assert.equal((payload as ScoreWriteResponse).scene, "detail_page");
  assert.equal((payload as ScoreWriteResponse).traceId, "trace-ok-1");
  assert.equal((payload as ScoreWriteResponse).score, 5);
});

test("POST /api/prompts/[slug]/versions/[versionNo]/score 非法分值返回 400", async () => {
  const scoreRoute = await loadScoreRouteModule();

  const invalidScores = [0, 6, 3.5];
  for (const invalidScore of invalidScores) {
    const response = await scoreRoute.POST(
      createPostScoreRequest({
        score: invalidScore,
        scene: "detail_page",
        traceId: `trace-invalid-${invalidScore}`,
      }),
      { params: Promise.resolve({ slug, versionNo }) },
    );
    const payload = (await response.json()) as { error: string };
    assert.equal(response.status, 400);
    assert.equal(typeof payload.error, "string");
  }
});

test("POST /api/prompts/[slug]/versions/[versionNo]/score scene 必填", async () => {
  const scoreRoute = await loadScoreRouteModule();

  const response = await scoreRoute.POST(
    createPostScoreRequest({ score: 4, scene: "   ", traceId: "trace-no-scene-1" }),
    { params: Promise.resolve({ slug, versionNo }) },
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 400);
  assert.equal(typeof payload.error, "string");
});

test("POST /api/prompts/[slug]/versions/[versionNo]/score 在 version 不存在时返回 404", async () => {
  const scoreRoute = await loadScoreRouteModule();

  const response = await scoreRoute.POST(
    new Request(
      `http://localhost:3000/api/prompts/${slug}/versions/${missingVersionNo}/score`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: buildAuthCookie({
            uid: "alice@example.com",
            name: "alice@example.com",
            can_manage: false,
          }),
        },
        body: JSON.stringify({
          score: 5,
          scene: "detail_page",
          traceId: "trace-not-found-1",
        }),
      },
    ),
    { params: Promise.resolve({ slug, versionNo: missingVersionNo }) },
  );
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 404);
  assert.equal(typeof payload.error, "string");
});

test("POST /score 未登录返回 401，伪造 x-user-email 不生效", async () => {
  const scoreRoute = await loadScoreRouteModule();
  const response = await scoreRoute.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${versionNo}/score`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-email": "forged@example.com",
      },
      body: JSON.stringify({ score: 5, scene: "detail_page", traceId: "forged" }),
    }),
    { params: Promise.resolve({ slug, versionNo }) },
  );
  assert.equal(response.status, 401);
});

test("POST /score 同 IP 同卡片同日重复评分返回 429", async () => {
  const scoreRoute = await loadScoreRouteModule();
  const first = await scoreRoute.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${versionNo}/score`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: buildAuthCookie({ uid: "u1@example.com", name: "u1", can_manage: false }),
        "x-forwarded-for": "203.0.113.20",
      },
      body: JSON.stringify({ score: 5, scene: "detail_page", traceId: "ip-day-1" }),
    }),
    { params: Promise.resolve({ slug, versionNo }) },
  );
  assert.equal(first.status, 200);

  const second = await scoreRoute.POST(
    new Request(`http://localhost:3000/api/prompts/${slug}/versions/${versionNo}/score`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: buildAuthCookie({ uid: "u2@example.com", name: "u2", can_manage: false }),
        "x-forwarded-for": "203.0.113.20",
      },
      body: JSON.stringify({ score: 4, scene: "detail_page", traceId: "ip-day-2" }),
    }),
    { params: Promise.resolve({ slug, versionNo }) },
  );
  const payload = (await second.json()) as { error?: string };
  assert.equal(second.status, 429);
  assert.match(String(payload.error ?? ""), /今日该卡片已操作|今天已经对该卡片操作过/);
});

test("POST 写入后 GET /score-stats 可见", async () => {
  const scoreRoute = await loadScoreRouteModule();
  const statsRoute = await loadScoreStatsRouteModule();

  const before = await readScoreStats(statsRoute);
  assert.equal(before.response.status, 200);
  assert.equal((before.payload as ScoreStatsResponse).totalScores, 0);

  const writeResponse = await scoreRoute.POST(
    createPostScoreRequest({
      score: 2,
      scene: "detail_page",
      traceId: "trace-visible-1",
    }),
    { params: Promise.resolve({ slug, versionNo }) },
  );
  assert.equal(writeResponse.status, 200);

  const after = await readScoreStats(statsRoute);
  assert.equal(after.response.status, 200);
  assert.equal((after.payload as ScoreStatsResponse).totalScores, 1);
  assert.equal((after.payload as ScoreStatsResponse).averageScore, 2);
  assert.equal((after.payload as ScoreStatsResponse).distribution["2"], 1);
});

test("GET /score-stats 返回平均分、1-5 分布、低分率，并支持 scene 过滤", async () => {
  const scoreRoute = await loadScoreRouteModule();
  const statsRoute = await loadScoreStatsRouteModule();

  const writes = [
    { score: 1, scene: "detail_page", traceId: "trace-stats-1", userEmail: "a1@example.com", ip: "203.0.113.41" },
    { score: 2, scene: "detail_page", traceId: "trace-stats-2", userEmail: "a2@example.com", ip: "203.0.113.42" },
    { score: 4, scene: "detail_page", traceId: "trace-stats-3", userEmail: "a3@example.com", ip: "203.0.113.43" },
    { score: 5, scene: "detail_page", traceId: "trace-stats-4", userEmail: "a4@example.com", ip: "203.0.113.44" },
    { score: 5, scene: "search_result", traceId: "trace-stats-5", userEmail: "a5@example.com", ip: "203.0.113.45" },
  ];

  for (const write of writes) {
    const response = await scoreRoute.POST(createPostScoreRequest(write), {
      params: Promise.resolve({ slug, versionNo }),
    });
    assert.equal(response.status, 200);
  }

  const allStats = await readScoreStats(statsRoute);
  assert.equal(allStats.response.status, 200);
  assert.equal((allStats.payload as ScoreStatsResponse).totalScores, 5);
  assert.equal((allStats.payload as ScoreStatsResponse).averageScore, 3.4);
  assert.equal((allStats.payload as ScoreStatsResponse).lowScoreRate, 0.4);
  assert.deepEqual((allStats.payload as ScoreStatsResponse).distribution, {
    "1": 1,
    "2": 1,
    "3": 0,
    "4": 1,
    "5": 2,
  });

  const filteredStats = await readScoreStats(statsRoute, { scene: "detail_page" });
  assert.equal(filteredStats.response.status, 200);
  assert.equal((filteredStats.payload as ScoreStatsResponse).scene, "detail_page");
  assert.equal((filteredStats.payload as ScoreStatsResponse).totalScores, 4);
  assert.equal((filteredStats.payload as ScoreStatsResponse).averageScore, 3);
  assert.equal((filteredStats.payload as ScoreStatsResponse).lowScoreRate, 0.5);
  assert.deepEqual((filteredStats.payload as ScoreStatsResponse).distribution, {
    "1": 1,
    "2": 1,
    "3": 0,
    "4": 1,
    "5": 1,
  });
});

test("POST /score 在缺少日频限流基础设施时应 fail-closed 返回 500", async (t) => {
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

      const scoreRoute = await loadScoreRouteModule();
      const response = await scoreRoute.POST(
        new Request(`http://localhost:3000/api/prompts/${slug}/versions/${versionNo}/score`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            cookie: buildAuthCookie({ uid: "u1@example.com", name: "u1", can_manage: false }),
            "x-forwarded-for": "203.0.113.41",
          },
          body: JSON.stringify({ score: 5, scene: "detail_page", traceId: "infra-missing" }),
        }),
        { params: Promise.resolve({ slug, versionNo }) },
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
