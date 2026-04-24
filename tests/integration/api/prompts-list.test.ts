import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../../apps/web/app/api/prompts/route.ts";

type PromptListItem = {
  slug: string;
  title: string;
  summary: string;
  likesCount: number;
  updatedAt: string;
  categorySlug: string;
  categories: Array<{
    slug: string;
    name: string;
  }>;
  categorySlugs: string[];
};

test("GET /api/prompts 默认返回最小卡片数组", async () => {
  const request = new Request("http://localhost:3000/api/prompts");
  const response = await GET(request);
  const payload = (await response.json()) as PromptListItem[];

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload), "响应应为数组");
  assert.ok(payload.length > 0, "列表至少返回 1 条数据");

  const first = payload[0];
  assert.equal(typeof first.slug, "string");
  assert.equal(typeof first.title, "string");
  assert.equal(typeof first.summary, "string");
  assert.equal(typeof first.likesCount, "number");
  assert.equal(typeof first.updatedAt, "string");
  assert.ok(Array.isArray(first.categories), "应返回 categories[] 兼容字段");
  assert.ok(Array.isArray(first.categorySlugs), "应返回 categorySlugs[] 兼容字段");
  assert.ok(first.categories.length >= 1, "categories[] 至少应有 1 项");
  assert.equal(
    first.categorySlugs.includes(first.categorySlug),
    true,
    "categorySlugs[] 应包含兼容字段 categorySlug",
  );
});

test("GET /api/prompts 支持按分类过滤", async () => {
  const request = new Request(
    "http://localhost:3000/api/prompts?category=programming",
  );
  const response = await GET(request);
  const payload = (await response.json()) as PromptListItem[];

  assert.equal(response.status, 200);
  assert.ok(payload.length > 0, "programming 分类结果不应为空");
  assert.equal(
    payload.every((item) => item.categorySlug === "programming"),
    true,
    "分类过滤后应全部属于 programming",
  );
});

test("GET /api/prompts 支持多分类 OR 过滤", async () => {
  const request = new Request(
    "http://localhost:3000/api/prompts?categories=programming,design",
  );
  const response = await GET(request);
  const payload = (await response.json()) as PromptListItem[];

  assert.equal(response.status, 200);
  assert.ok(payload.length > 0, "多分类 OR 过滤结果不应为空");
  assert.equal(
    payload.every(
      (item) =>
        item.categorySlugs.includes("programming") ||
        item.categorySlugs.includes("design"),
    ),
    true,
    "OR 过滤后每条数据至少命中一个分类",
  );
  assert.equal(
    payload.some((item) => item.categorySlugs.includes("programming")),
    true,
    "OR 结果应包含 programming 项",
  );
  assert.equal(
    payload.some((item) => item.categorySlugs.includes("design")),
    true,
    "OR 结果应包含 design 项",
  );
});

test("GET /api/prompts 多分类筛选传空数组时按不过滤处理", async () => {
  const allResponse = await GET(new Request("http://localhost:3000/api/prompts"));
  const allPayload = (await allResponse.json()) as PromptListItem[];

  const emptyFilterResponse = await GET(
    new Request("http://localhost:3000/api/prompts?categories="),
  );
  const emptyFilterPayload = (await emptyFilterResponse.json()) as PromptListItem[];

  assert.equal(allResponse.status, 200);
  assert.equal(emptyFilterResponse.status, 200);
  assert.equal(
    emptyFilterPayload.length,
    allPayload.length,
    "categories 为空时应与不传分类过滤等价",
  );
});

test("GET /api/prompts 支持基础关键词过滤", async () => {
  const keyword = "索引";
  const request = new Request(
    `http://localhost:3000/api/prompts?keyword=${encodeURIComponent(keyword)}`,
  );
  const response = await GET(request);
  const payload = (await response.json()) as PromptListItem[];

  assert.equal(response.status, 200);
  assert.ok(payload.length > 0, "关键词过滤结果不应为空");
  assert.equal(
    payload.every(
      (item) =>
        item.title.includes(keyword) || item.summary.includes(keyword),
    ),
    true,
    "关键词过滤应命中标题或摘要",
  );
});

test("GET /api/prompts 支持按点赞热度排序", async () => {
  const request = new Request("http://localhost:3000/api/prompts?sort=popular");
  const response = await GET(request);
  const payload = (await response.json()) as PromptListItem[];

  assert.equal(response.status, 200);
  assert.ok(payload.length > 1, "热门排序至少需要 2 条数据进行比较");

  for (let index = 1; index < payload.length; index += 1) {
    assert.ok(
      payload[index - 1].likesCount >= payload[index].likesCount,
      "popular 排序应按 likesCount 降序",
    );
  }
});
