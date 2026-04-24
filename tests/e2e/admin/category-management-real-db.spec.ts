import { expect, test } from "@playwright/test";

function generateSlugFromTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized) {
    return normalized;
  }

  let hash = 0;
  for (const char of title) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000000007;
  }
  return `prompt-${Math.abs(hash)}`;
}

test("真实 DB: 分类管理新增/删除与待分类补偿链路可用", async ({ page }) => {
  const marker = Date.now();
  const categoryName = `Task6分类-${marker}`;
  const categorySlug = `task6-category-${marker}`;
  const title = `Task6 分类补偿提示词 ${marker}`;
  const promptSlug = generateSlugFromTitle(title);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 2, name: "分类管理" })).toBeVisible();

  await page.getByLabel("新增分类名称").fill(categoryName);
  await page.getByLabel("新增分类Slug").fill(categorySlug);
  await page.getByRole("button", { name: "新增分类" }).click();
  await expect(page.getByRole("status")).toContainText("新增分类成功");
  await expect(page.getByTestId(`admin-category-row-${categorySlug}`)).toContainText(
    categoryName,
  );

  await page.goto("/admin/create");
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("摘要").fill("用于验证删除分类后的待分类补偿。");
  await page.getByLabel(categoryName).check();
  await page.getByRole("textbox", { name: "内容" }).fill(`Task6 内容 ${marker}`);
  await page.getByRole("button", { name: "提交创建" }).click();
  await expect(page.getByRole("status")).toContainText("已创建");
  await expect(page.getByRole("status")).toContainText(title);

  await page.goto("/admin");
  const categoryRow = page.getByTestId(`admin-category-row-${categorySlug}`);
  await expect(categoryRow).toBeVisible();
  await categoryRow.getByRole("button", { name: "删除" }).click();

  await expect(page.getByText("受影响提示词：1")).toBeVisible();
  await expect(page.getByText("将归入待分类：1")).toBeVisible();
  await page.getByRole("button", { name: "确认删除分类" }).click();
  await expect(page.getByRole("status")).toContainText("已删除分类");
  await expect(page.getByTestId(`admin-category-row-${categorySlug}`)).toHaveCount(0);

  const detailResponse = await page.request.get(`/api/prompts/${promptSlug}`);
  expect(detailResponse.status()).toBe(200);
  const detail = (await detailResponse.json()) as {
    categorySlugs?: string[];
  };
  expect(Array.isArray(detail.categorySlugs)).toBeTruthy();
  expect(detail.categorySlugs).toContain("uncategorized");
  expect(detail.categorySlugs).not.toContain(categorySlug);
});
