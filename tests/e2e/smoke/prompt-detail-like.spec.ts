import { expect, test } from "@playwright/test";

test("详情页官方卡支持版本级点赞", async ({ page }) => {
  const versionLikes = new Map([
    ["v0001", { likesCount: 0, liked: false }],
  ]);

  await page.route("**/api/prompts/js-code-reviewer/versions/*/like", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const versionNo = url.pathname.split("/").at(-2);

    if (!versionNo || !versionLikes.has(versionNo)) {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid versionNo" }),
      });
      return;
    }

    const current = versionLikes.get(versionNo);
    if (!current) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ error: "version not found" }),
      });
      return;
    }

    const next =
      request.method() === "DELETE"
        ? { likesCount: Math.max(current.likesCount - 1, 0), liked: false }
        : { likesCount: current.likesCount + 1, liked: true };
    versionLikes.set(versionNo, next);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        slug: "js-code-reviewer",
        versionNo,
        likesCount: next.likesCount,
        liked: next.liked,
      }),
    });
  });

  const response = await page.goto("/prompts/js-code-reviewer");
  expect(response?.status()).toBe(200);

  const officialCard = page.getByTestId("official-card");
  await expect(officialCard).toBeVisible();
  const initialLikeText = await officialCard.getByTestId("version-like-count").innerText();
  const initialLikeCount = Number.parseInt(initialLikeText, 10);
  expect(Number.isFinite(initialLikeCount)).toBeTruthy();

  await officialCard.getByTestId("version-like-button").click();
  await expect(officialCard.getByTestId("version-like-count")).toHaveText(`${initialLikeCount + 1} 赞`);
  await expect(officialCard.getByTestId("version-like-button")).toContainText("取消点赞");
});
