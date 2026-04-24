import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../../apps/web/app/api/prompts/[slug]/route.ts";

type PromptDetail = {
  slug: string;
  title: string;
  summary: string;
  likesCount: number;
  categories: Array<{
    slug: string;
    name: string;
  }>;
  category: {
    slug: string;
    name: string;
  };
  currentVersion: {
    versionNo: string;
    content: string;
    sourceType: string;
  };
  versions: Array<{
    versionNo: string;
    sourceType: string;
    status: "approved" | "pending" | "rejected";
    content?: string;
  }>;
};

test("GET /api/prompts/[slug] 返回最小详情结构", async () => {
  const response = await GET(new Request("http://localhost:3000"), {
    params: { slug: "js-code-reviewer" },
  });
  const payload = (await response.json()) as PromptDetail;

  assert.equal(response.status, 200);
  assert.equal(payload.slug, "js-code-reviewer");
  assert.equal(typeof payload.title, "string");
  assert.equal(typeof payload.summary, "string");
  assert.ok(Array.isArray(payload.categories), "应返回 categories[] 兼容字段");
  assert.ok(payload.categories.length >= 1, "categories[] 至少包含 1 条");
  assert.equal(typeof payload.category.slug, "string");
  assert.equal(typeof payload.category.name, "string");
  assert.equal(
    payload.categories.some((category) => category.slug === payload.category.slug),
    true,
    "兼容字段 category 应映射到 categories[]",
  );
  assert.equal(typeof payload.currentVersion.versionNo, "string");
  assert.equal(typeof payload.currentVersion.content, "string");
  assert.ok(Array.isArray(payload.versions), "versions 应为数组");
  assert.ok(payload.versions.length >= 1, "versions 至少包含 1 条");
});

test("GET /api/prompts/[slug] 不暴露 rejected 版本正文", async () => {
  const response = await GET(new Request("http://localhost:3000"), {
    params: { slug: "js-code-reviewer" },
  });
  const payload = (await response.json()) as PromptDetail;

  assert.equal(response.status, 200);

  for (const version of payload.versions) {
    if (version.status === "rejected") {
      assert.equal(
        "content" in version,
        false,
        "rejected 版本不应暴露正文 content",
      );
    }
  }
});

test("GET /api/prompts/[slug] 在 slug 不存在时返回 404", async () => {
  const response = await GET(new Request("http://localhost:3000"), {
    params: { slug: "not-exist-slug" },
  });
  const payload = (await response.json()) as { error: string };

  assert.equal(response.status, 404);
  assert.equal(typeof payload.error, "string");
});
