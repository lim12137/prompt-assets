import { test, expect } from "@playwright/test";

test("home page task8: 首页四区/右上角操作/数据卡片可见", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByTestId("home-section-overview")).toBeVisible();
  await expect(page.getByTestId("home-section-categories")).toBeVisible();
  await expect(page.getByTestId("home-section-list")).toBeVisible();
  await expect(page.getByTestId("home-section-activity")).toBeVisible();

  await expect(page.getByRole("button", { name: "导入" })).toBeVisible();
  await expect(page.getByRole("button", { name: "管理" })).toBeVisible();
  await expect(page.getByRole("button", { name: "创建" })).toBeVisible();

  await expect(page.getByTestId("prompt-card").first()).toBeVisible();
  await expect(page.getByText("UX 研究计划器")).toBeVisible();
});
