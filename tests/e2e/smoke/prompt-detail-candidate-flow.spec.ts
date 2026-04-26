import { expect, test } from "@playwright/test";

test("详情页展示官方推荐卡与员工最新候选卡，并支持提交候选与复制", async ({
  page,
}) => {
  const submitHeaders: string[] = [];
  const versionLikes = new Map([
    ["v0001", { likesCount: 0, liked: false }],
    ["v0002", { likesCount: 0, liked: false }],
  ]);

  await page.route("**/api/prompts/js-code-reviewer/submissions", async (route) => {
    submitHeaders.push(route.request().headers()["x-user-email"] ?? "");
    await route.continue();
  });
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

  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {},
      },
    });
  });

  await page.goto("/prompts/js-code-reviewer");

  const officialCard = page.getByTestId("official-card");
  const candidateCard = page.getByTestId("employee-candidate-card").first();

  await expect(officialCard).toBeVisible();
  await expect(candidateCard).toBeVisible();
  const initialOfficialLikeText = await officialCard.getByTestId("version-like-count").innerText();
  const initialCandidateLikeText = await candidateCard.getByTestId("version-like-count").innerText();
  const initialOfficialLikeCount = Number.parseInt(initialOfficialLikeText, 10);
  const initialCandidateLikeCount = Number.parseInt(initialCandidateLikeText, 10);
  expect(Number.isFinite(initialOfficialLikeCount)).toBeTruthy();
  expect(Number.isFinite(initialCandidateLikeCount)).toBeTruthy();

  await candidateCard.getByTestId("version-like-button").click();
  await expect(candidateCard.getByTestId("version-like-count")).toHaveText(`${initialCandidateLikeCount + 1} 赞`);
  await expect(officialCard.getByTestId("version-like-count")).toHaveText(`${initialOfficialLikeCount} 赞`);

  await page
    .getByTestId("official-card")
    .getByRole("button", { name: "复制此卡内容" })
    .click();
  await expect(page.getByRole("status")).toContainText("复制成功");

  await officialCard.getByTestId("version-like-button").click();
  await expect(officialCard.getByTestId("version-like-count")).toHaveText(`${initialOfficialLikeCount + 1} 赞`);
  await expect(candidateCard.getByTestId("version-like-count")).toHaveText(`${initialCandidateLikeCount + 1} 赞`);

  await candidateCard.getByTestId("version-like-button").click();
  await expect(candidateCard.getByTestId("version-like-count")).toHaveText(`${initialCandidateLikeCount} 赞`);
  await expect(officialCard.getByTestId("version-like-count")).toHaveText(`${initialOfficialLikeCount + 1} 赞`);

  await page.getByRole("button", { name: "提交候选迭代" }).click();
  await page.getByLabel("员工邮箱").fill("bob@example.com");
  await page.getByLabel("候选内容").fill("候选一版内容AAA");
  await page.getByRole("button", { name: "提交候选", exact: true }).click();
  await expect(page.getByText("提交中...")).toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();
  await expect(page.getByText("-cand-bob-")).toBeVisible();

  await page.getByLabel("候选内容").fill("候选二版内容BBB");
  await page.getByRole("button", { name: "提交候选", exact: true }).click();
  await expect(page.getByText("提交中...")).toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();

  expect(submitHeaders.some((value) => value === "bob@example.com")).toBeTruthy();
});
