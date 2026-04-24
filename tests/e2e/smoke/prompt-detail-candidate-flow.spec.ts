import { expect, test } from "@playwright/test";

test("详情页展示官方推荐卡与员工最新候选卡，并支持提交候选与复制", async ({
  page,
}) => {
  const submitHeaders: string[] = [];
  await page.route("**/api/prompts/js-code-reviewer/submissions", async (route) => {
    submitHeaders.push(route.request().headers()["x-user-email"] ?? "");
    await route.continue();
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

  await expect(page.getByTestId("official-card")).toBeVisible();
  await expect(page.getByTestId("employee-candidate-card").first()).toBeVisible();

  await page
    .getByTestId("official-card")
    .getByRole("button", { name: "复制此卡内容" })
    .click();
  await expect(page.getByRole("status")).toContainText("复制成功");

  await page.getByRole("button", { name: "提交候选迭代" }).click();
  await page.getByLabel("员工邮箱").fill("bob@example.com");
  await page.getByLabel("候选内容").fill("候选一版内容AAA");
  await page.getByRole("button", { name: "提交候选", exact: true }).click();
  await expect(page.getByText("提交中...")).toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();
  await expect(page.getByText("v0001-cand-bob-")).toBeVisible();

  await page.getByLabel("候选内容").fill("候选二版内容BBB");
  await page.getByRole("button", { name: "提交候选", exact: true }).click();
  await expect(page.getByText("提交中...")).toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();

  await page.reload();
  const bobCard = page
    .getByTestId("employee-candidate-card")
    .filter({ hasText: "bob@example.com 的候选" });
  await expect(bobCard).toHaveCount(1);
  await expect(bobCard).toContainText(
    "候选二版内容BBB",
  );
  await expect(bobCard).not.toContainText(
    "候选一版内容AAA",
  );
  expect(submitHeaders.some((value) => value === "bob@example.com")).toBeTruthy();
});
