import { expect, test } from "@playwright/test";

test("真实 DB: 详情页与候选提交主链路可用", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {},
      },
    });
  });

  const response = await page.goto("/prompts/js-code-reviewer");
  expect(response?.status()).toBe(200);

  await expect(page.getByTestId("official-card")).toBeVisible();
  await expect(page.getByTestId("employee-candidate-card").first()).toBeVisible();

  await page
    .getByTestId("official-card")
    .getByRole("button", { name: "复制此卡内容" })
    .click();
  await expect(page.getByRole("status")).toContainText("复制成功");

  await page.getByRole("button", { name: "提交候选迭代" }).click();
  const marker = `real-db-${Date.now()}`;
  await page.getByLabel("候选内容").fill(`真实DB候选内容:${marker}`);
  await page.getByRole("button", { name: "提交候选", exact: true }).click();
  await expect(page.getByText("提交中...")).toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();
  await expect(page.getByText("v0001-cand-alice-")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("employee-candidate-card")).toContainText(marker);
});
