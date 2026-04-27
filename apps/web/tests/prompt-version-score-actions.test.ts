import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchVersionScoreStats,
  formatScoreStatsSummary,
  mutateVersionScore,
} from "../app/prompts/[slug]/_prompt-actions.js";

type MockResponseInit = {
  ok: boolean;
  status: number;
  payload: unknown;
};

function createMockResponse(init: MockResponseInit): Response {
  return {
    ok: init.ok,
    status: init.status,
    json: async () => init.payload,
  } as Response;
}

test("formatScoreStatsSummary 输出最小统计文案", () => {
  assert.equal(
    formatScoreStatsSummary({
      averageScore: 3.5,
      totalScores: 2,
      lowScoreRate: 0.5,
    }),
    "均分 3.50 · 2 人评分 · 低分率 50%",
  );
  assert.equal(
    formatScoreStatsSummary({
      averageScore: 0,
      totalScores: 0,
      lowScoreRate: 0,
    }),
    "暂无评分",
  );
});

test("fetchVersionScoreStats 请求 score-stats 并返回结构化结果", async () => {
  const capturedUrls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input) => {
    capturedUrls.push(String(input));
    return createMockResponse({
      ok: true,
      status: 200,
      payload: {
        slug: "js-code-reviewer",
        versionNo: "v0001",
        scene: "detail_page",
        totalScores: 3,
        averageScore: 3.67,
        lowScoreRate: 0.3333,
        distribution: { "1": 0, "2": 1, "3": 0, "4": 1, "5": 1 },
      },
    });
  }) as typeof fetch;

  try {
    const result = await fetchVersionScoreStats("js-code-reviewer", "v0001", "detail_page");
    assert.equal(capturedUrls.length, 1);
    assert.match(capturedUrls[0] ?? "", /\/api\/prompts\/js-code-reviewer\/versions\/v0001\/score-stats\?scene=detail_page$/);
    assert.equal(result.totalScores, 3);
    assert.equal(result.averageScore, 3.67);
    assert.equal(result.lowScoreRate, 0.3333);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("mutateVersionScore 请求 score 接口并附带分值与场景", async () => {
  const captured: Array<{
    input: RequestInfo | URL;
    init: RequestInit | undefined;
  }> = [];

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    captured.push({ input, init });
    return createMockResponse({
      ok: true,
      status: 200,
      payload: {
        slug: "js-code-reviewer",
        versionNo: "v0001",
        scene: "detail_page",
        traceId: "trace-case-1",
        score: 4,
      },
    });
  }) as typeof fetch;

  try {
    const payload = await mutateVersionScore("js-code-reviewer", "v0001", {
      score: 4,
      scene: "detail_page",
      actorEmail: "alice@example.com",
      traceId: "trace-case-1",
    });

    assert.equal(captured.length, 1);
    assert.match(
      String(captured[0]?.input ?? ""),
      /\/api\/prompts\/js-code-reviewer\/versions\/v0001\/score$/,
    );
    assert.equal(captured[0]?.init?.method, "POST");
    assert.deepEqual(
      JSON.parse(String(captured[0]?.init?.body ?? "{}")),
      { score: 4, scene: "detail_page", traceId: "trace-case-1" },
    );
    assert.equal(payload.score, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
