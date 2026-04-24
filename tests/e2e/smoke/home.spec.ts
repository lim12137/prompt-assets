import { test, expect } from "@playwright/test";

async function createPromptByApi(
  request: Parameters<typeof test>[0]["request"],
  input: {
    title: string;
    slug: string;
    summary: string;
    content: string;
    categorySlugs?: string[];
  },
): Promise<void> {
  const response = await request.post("/api/prompts", {
    headers: {
      "content-type": "application/json",
      "x-user-email": "admin@example.com",
      "x-user-role": "admin",
    },
    data: input,
  });
  expect(response.status()).toBe(201);
}

test("home page task4: 页面名称为公司提示词库", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.getByRole("heading", { level: 1, name: "公司提示词库" })).toBeVisible();
  await expect(page.getByTestId("home-section-categories")).toBeVisible();
  await expect(page.getByTestId("home-section-list")).toBeVisible();
  await expect(page.getByTestId("prompt-card").first()).toBeVisible();
});

test("home page task4: 分类支持多选 OR 过滤", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "编程" }).click();
  await page.getByRole("button", { name: "设计" }).click();

  await expect(page.getByText("JavaScript 代码审查助手")).toBeVisible();
  await expect(page.getByText("UX 研究计划器")).toBeVisible();
  await expect(page.getByText("博客大纲生成器")).toHaveCount(0);
});

test("home page task4: 系统待分类默认折叠", async ({ page }) => {
  const slug = `home-uncategorized-${Date.now()}`;
  await createPromptByApi(page.request, {
    title: "待分类折叠验证",
    slug,
    summary: "用于验证系统待分类默认折叠",
    content: "uncategorized collapsed default",
  });

  await page.goto("/");

  const aside = page.getByTestId("home-section-categories");
  await expect(aside.getByTestId("system-categories-toggle")).toBeVisible();
  await expect(aside.getByTestId("system-categories-panel")).not.toHaveAttribute("open", "");
  await aside.getByTestId("system-categories-toggle").click();
  await expect(aside.getByTestId("system-categories-panel")).toHaveAttribute("open", "");
  await expect(aside.getByRole("button", { name: "待分类" })).toBeVisible();
});

test("home page task4: 卡片与列表都展示多分类标签", async ({ page }) => {
  const slug = `home-multi-tags-${Date.now()}`;
  const title = `多标签展示-${Date.now()}`;
  await createPromptByApi(page.request, {
    title,
    slug,
    summary: "用于验证列表/卡片多标签展示",
    content: "multi categories tags",
    categorySlugs: ["programming", "design"],
  });

  await page.goto("/");

  const card = page.locator("[data-testid='prompt-card']").filter({ hasText: title }).first();
  await expect(card).toBeVisible();
  await expect(card.getByTestId("prompt-category-tag")).toHaveCount(2);
  await expect(card.getByText("编程")).toBeVisible();
  await expect(card.getByText("设计")).toBeVisible();

  await page.getByRole("button", { name: "列表视图" }).click();
  const listItem = page.locator("[data-testid='prompt-card']").filter({ hasText: title }).first();
  await expect(listItem).toBeVisible();
  await expect(listItem.getByTestId("prompt-category-tag")).toHaveCount(2);
  await expect(listItem.getByText("编程")).toBeVisible();
  await expect(listItem.getByText("设计")).toBeVisible();
});
