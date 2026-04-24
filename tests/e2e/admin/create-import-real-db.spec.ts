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

test("真实 DB: 管理创建与批量导入链路可用", async ({ page }) => {
  const marker = Date.now();
  const createTitle = `真实DB创建标题-${marker}`;
  const importTitle = `真实DB导入标题-${marker}`;
  const createSlug = generateSlugFromTitle(createTitle);
  const importSlug = generateSlugFromTitle(importTitle);

  await page.goto("/admin/create");
  await page.getByLabel("标题").fill(createTitle);
  await page.getByLabel("摘要").fill("真实DB创建链路回归摘要。");
  await page.getByLabel("编程").check();
  await page.getByRole("textbox", { name: "内容" }).fill(`真实DB创建正文:${marker}`);
  await page.getByRole("button", { name: "提交创建" }).click();
  await expect(page.getByRole("status")).toContainText("创建请求提交中");
  await expect(page.getByRole("status")).toContainText("已创建");
  await expect(page.getByRole("status")).toContainText(createTitle);

  const createdDetail = await page.goto(`/prompts/${createSlug}`);
  expect(createdDetail?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: createTitle }),
  ).toBeVisible();

  await page.goto("/admin/import");
  const importPayload = JSON.stringify(
    [
      {
        title: importTitle,
        summary: "真实DB导入链路回归摘要。",
        categorySlugs: ["programming"],
        content: `真实DB导入正文:${marker}`,
      },
    ],
    null,
    2,
  );
  await page.getByLabel("JSON 内容").fill(importPayload);
  await page.getByRole("button", { name: "提交导入" }).click();
  await expect(page.getByRole("status")).toContainText("导入请求提交中");
  await expect(page.getByRole("status")).toContainText("导入成功");
  await expect(page.getByRole("status")).toContainText(importTitle);

  const importedDetail = await page.goto(`/prompts/${importSlug}`);
  expect(importedDetail?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: importTitle }),
  ).toBeVisible();
});
