import test from "node:test";
import assert from "node:assert/strict";

import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";

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
}): Request {
  return new Request(
    `http://localhost:3000/api/prompts/${slug}/versions/${versionNo}/score`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-email": input.userEmail ?? "alice@example.com",
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
  __resetPromptLikeFixtureStateForTests();
});

test.after(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
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
          "x-user-email": "alice@example.com",
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
    { score: 1, scene: "detail_page", traceId: "trace-stats-1", userEmail: "a1@example.com" },
    { score: 2, scene: "detail_page", traceId: "trace-stats-2", userEmail: "a2@example.com" },
    { score: 4, scene: "detail_page", traceId: "trace-stats-3", userEmail: "a3@example.com" },
    { score: 5, scene: "detail_page", traceId: "trace-stats-4", userEmail: "a4@example.com" },
    { score: 5, scene: "search_result", traceId: "trace-stats-5", userEmail: "a5@example.com" },
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
