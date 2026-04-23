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

test("home page task9: 分类筛选只展示命中分类", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "编程" }).click();

  await expect(page.getByText("JavaScript 代码审查助手")).toBeVisible();
  await expect(page.getByText("SQL 索引建议器")).toBeVisible();
  await expect(page.getByText("API 报错定位助手")).toBeVisible();
  await expect(page.getByText("UX 研究计划器")).toHaveCount(0);
});

test("home page task9: 关键词过滤与空态提示", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("关键词搜索").fill("索引");
  await expect(page.getByText("SQL 索引建议器")).toBeVisible();
  await expect(page.getByText("JavaScript 代码审查助手")).toHaveCount(0);

  await page.getByLabel("关键词搜索").fill("不存在的关键词");
  await expect(page.getByTestId("home-empty-state")).toBeVisible();
  await expect(page.getByTestId("home-empty-state")).toContainText(
    "未找到匹配的提示词",
  );

  await page.getByRole("button", { name: "清空搜索" }).click();
  await expect(page.getByTestId("home-empty-state")).toHaveCount(0);
  await expect(page.getByText("SQL 索引建议器")).toBeVisible();
  await expect(page.getByText("JavaScript 代码审查助手")).toBeVisible();
});
