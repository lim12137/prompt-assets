import test from "node:test";
import assert from "node:assert/strict";

import {
  DELETE,
  POST,
} from "../../../apps/web/app/api/prompts/[slug]/like/route.ts";
import { GET as getPromptDetail } from "../../../apps/web/app/api/prompts/[slug]/route.ts";
import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";

type LikeResponse = {
  slug: string;
  likesCount: number;
  liked: boolean;
};

type PromptDetail = {
  slug: string;
  likesCount: number;
};

const slug = "api-debug-assistant";
const userEmail = "alice@example.com";

async function readLikesCount(targetSlug: string): Promise<number> {
  const detailResponse = await getPromptDetail(new Request("http://localhost:3000"), {
    params: { slug: targetSlug },
  });
  const detail = (await detailResponse.json()) as PromptDetail;
  return detail.likesCount;
}

test.beforeEach(() => {
  __resetPromptLikeFixtureStateForTests();
});

test("POST /api/prompts/[slug]/like 首次点赞创建并增加 likesCount", async () => {
  const beforeCount = await readLikesCount(slug);

  const response = await POST(new Request("http://localhost:3000", {
    method: "POST",
    headers: { "x-user-email": userEmail },
  }), {
    params: { slug },
  });
  const payload = (await response.json()) as LikeResponse;
  const afterCount = await readLikesCount(slug);

  assert.equal(response.status, 200);
  assert.equal(payload.slug, slug);
  assert.equal(payload.liked, true);
  assert.equal(payload.likesCount, beforeCount + 1);
  assert.equal(afterCount, beforeCount + 1);
});

test("POST /api/prompts/[slug]/like 重复点赞幂等，不重复计数", async () => {
  const first = await POST(new Request("http://localhost:3000", {
    method: "POST",
    headers: { "x-user-email": userEmail },
  }), {
    params: { slug },
  });
  const firstPayload = (await first.json()) as LikeResponse;

  const second = await POST(new Request("http://localhost:3000", {
    method: "POST",
    headers: { "x-user-email": userEmail },
  }), {
    params: { slug },
  });
  const secondPayload = (await second.json()) as LikeResponse;

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(secondPayload.liked, true);
  assert.equal(secondPayload.likesCount, firstPayload.likesCount);
});

test("DELETE /api/prompts/[slug]/like 取消点赞后计数回退", async () => {
  const beforeCount = await readLikesCount(slug);

  await POST(new Request("http://localhost:3000", {
    method: "POST",
    headers: { "x-user-email": userEmail },
  }), {
    params: { slug },
  });

  const response = await DELETE(new Request("http://localhost:3000", {
    method: "DELETE",
    headers: { "x-user-email": userEmail },
  }), {
    params: { slug },
  });
  const payload = (await response.json()) as LikeResponse;
  const afterCount = await readLikesCount(slug);

  assert.equal(response.status, 200);
  assert.equal(payload.liked, false);
  assert.equal(payload.likesCount, beforeCount);
  assert.equal(afterCount, beforeCount);
});
