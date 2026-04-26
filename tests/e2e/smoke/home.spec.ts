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

async function getPromptListByApi(
  request: Parameters<typeof test>[0]["request"],
): Promise<Array<{
  slug: string;
  title: string;
  currentVersionContent: string;
}>> {
  const response = await request.get("/api/prompts", {
    headers: {
      "x-user-email": "admin@example.com",
      "x-user-role": "admin",
    },
  });
  expect(response.status()).toBe(200);
  return (await response.json()) as Array<{
    slug: string;
    title: string;
    currentVersionContent: string;
  }>;
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

test("home page task4: 系统待分类默认折叠且不可手动勾选", async ({ page }) => {
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
  const uncategorizedOption = aside.getByRole("button", { name: "待分类" });
  await expect(uncategorizedOption).toBeVisible();
  await expect(uncategorizedOption).toBeDisabled();
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

test("home page ux: 点击卡片非链接区域也可跳转详情页", async ({ page }) => {
  const slug = "js-code-reviewer";
  const title = "JavaScript 代码审查助手";

  await page.goto("/");
  await page.getByLabel("关键词搜索").fill(title);

  const card = page.locator("[data-testid='prompt-card']").filter({ hasText: title }).first();
  await expect(card).toBeVisible();

  // 点击卡片左上区域，避免命中“查看详情”文本链接本身。
  await card.click({ position: { x: 12, y: 12 } });
  await expect(page).toHaveURL(new RegExp(`/prompts/${slug}$`));
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
});

test("home page ux: 点击查看详情行右侧复制按钮时不跳转且复制默认版本正文", async ({ page }) => {
  const slug = "js-code-reviewer";
  const title = "JavaScript 代码审查助手";
  const promptList = await getPromptListByApi(page.request);
  const seedPrompt = promptList.find((item) => item.slug === slug);
  expect(seedPrompt).toBeTruthy();
  const defaultContent = seedPrompt?.currentVersionContent ?? "";
  expect(defaultContent).not.toBe("");

  await page.addInitScript(() => {
    (window as typeof window & { __copiedText?: string }).__copiedText = "";
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as typeof window & { __copiedText?: string }).__copiedText = text;
        },
      },
    });
  });

  await page.goto("/");
  await page.getByLabel("关键词搜索").fill(title);
  await page.getByRole("button", { name: "列表视图" }).click();

  const listItem = page.locator("[data-testid='prompt-card']").filter({ hasText: title }).first();
  await expect(listItem).toBeVisible();

  const copyButton = listItem.getByRole("button", { name: /复制/ }).first();
  await expect(copyButton).toBeVisible();

  const beforeUrl = page.url();
  await copyButton.click();

  await expect(page).toHaveURL(beforeUrl);
  const copiedText = await page.evaluate(() => {
    return (window as typeof window & { __copiedText?: string }).__copiedText ?? "";
  });
  expect(copiedText).toBe(defaultContent);
});
