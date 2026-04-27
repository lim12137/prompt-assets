import { expect, test } from "@playwright/test";

test("详情页 ux-research-plan 候选版本 v0003 点赞链路可用", async ({
  page,
}) => {
  const response = await page.goto("/prompts/ux-research-plan");
  expect(response?.status()).toBe(200);

  const candidateCard = page
    .getByTestId("employee-candidate-card")
    .filter({ hasText: "版本 v0003" })
    .first();
  await expect(candidateCard).toBeVisible();

  const likeCountNode = candidateCard.getByTestId("version-like-count");
  const initialLikeText = await likeCountNode.innerText();
  const initialLikeCount = Number.parseInt(initialLikeText, 10);
  expect(Number.isFinite(initialLikeCount)).toBeTruthy();

  const likeResponsePromise = page.waitForResponse(
    (item) =>
      item.request().method() === "POST" &&
      item.url().includes("/api/prompts/ux-research-plan/versions/v0003/like"),
  );

  await candidateCard.getByTestId("version-like-button").click();

  const likeResponse = await likeResponsePromise;
  expect(likeResponse.status()).toBe(200);
  await expect(likeCountNode).toHaveText(`${initialLikeCount + 1} 赞`);
});
