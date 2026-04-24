import { expect, test } from "@playwright/test";

test("真实 DB: 管理创建与批量导入链路可用", async ({ page }) => {
  const marker = Date.now();
  const createSlug = `real-db-admin-create-${marker}`;
  const importSlug = `real-db-admin-import-${marker}`;

  await page.goto("/admin/create");
  await page.getByLabel("标题").fill(`真实DB创建标题-${marker}`);
  await page.getByLabel(/^Slug$/).fill(createSlug);
  await page.getByLabel("摘要").fill("真实DB创建链路回归摘要。");
  await page.getByLabel("分类 Slug").fill("programming");
  await page.getByLabel("内容").fill(`真实DB创建正文:${marker}`);
  await page.getByRole("button", { name: "提交创建" }).click();
  await expect(page.getByRole("status")).toContainText("创建请求提交中");
  await expect(page.getByRole("status")).toContainText("已创建");
  await expect(page.getByRole("status")).toContainText(createSlug);

  const createdDetail = await page.goto(`/prompts/${createSlug}`);
  expect(createdDetail?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: `提示词详情：真实DB创建标题-${marker}` }),
  ).toBeVisible();

  await page.goto("/admin/import");
  const importPayload = JSON.stringify(
    [
      {
        title: `真实DB导入标题-${marker}`,
        slug: importSlug,
        summary: "真实DB导入链路回归摘要。",
        categorySlug: "programming",
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
  await expect(page.getByRole("status")).toContainText(importSlug);

  const importedDetail = await page.goto(`/prompts/${importSlug}`);
  expect(importedDetail?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: `提示词详情：真实DB导入标题-${marker}` }),
  ).toBeVisible();
});
