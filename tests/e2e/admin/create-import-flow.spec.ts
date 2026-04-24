import { expect, test } from "@playwright/test";

test("管理页展示创建/导入入口并可跳转到目标页面", async ({ page }) => {
  await page.goto("/admin");

  await expect(page.getByRole("link", { name: "创建提示词" })).toBeVisible();
  await expect(page.getByRole("link", { name: "批量导入" })).toBeVisible();

  await page.getByRole("link", { name: "创建提示词" }).click();
  await expect(page).toHaveURL(/\/admin\/create$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "创建提示词" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "批量导入" }).click();
  await expect(page).toHaveURL(/\/admin\/import$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "批量导入提示词" }),
  ).toBeVisible();
});

test("管理创建页可提交并展示成功与失败反馈", async ({ page }) => {
  const slug = `e2e-admin-create-${Date.now()}`;
  let createRequestCount = 0;
  await page.route("**/api/prompts", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    createRequestCount += 1;
    if (createRequestCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          prompt: {
            slug,
            title: "E2E 管理创建标题",
            summary: "用于验证管理员创建页闭环。",
            categorySlug: "programming",
            currentVersion: {
              versionNo: "v0001",
              sourceType: "create",
            },
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "prompt slug already exists",
        code: "prompt_slug_conflict",
      }),
    });
  });

  await page.goto("/admin/create");
  await page.getByLabel("标题").fill("E2E 管理创建标题");
  await page.getByLabel(/^Slug$/).fill(slug);
  await page.getByLabel("摘要").fill("用于验证管理员创建页闭环。");
  await page.getByLabel("分类 Slug").fill("programming");
  await page.getByLabel("内容").fill("你是测试助手，请输出步骤和结果。");

  await page.getByRole("button", { name: "提交创建" }).click();
  await expect(page.getByRole("status")).toContainText("创建请求提交中");
  await expect(page.getByRole("status")).toContainText("已创建");
  await expect(page.getByRole("status")).toContainText(slug);

  await page.getByRole("button", { name: "提交创建" }).click();
  await expect(page.getByRole("status")).toContainText("创建失败");
});

test("管理导入页可提交并展示成功与失败反馈", async ({ page }) => {
  const slug = `e2e-admin-import-${Date.now()}`;
  await page.route("**/api/admin/prompts/import", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        total: 1,
        mode: "all_or_nothing",
        prompts: [
          {
            slug,
            title: "E2E 导入标题",
            summary: "用于验证导入页闭环。",
            categorySlug: "programming",
            currentVersion: {
              versionNo: "v0001",
              sourceType: "create",
            },
          },
        ],
      }),
    });
  });
  const payload = JSON.stringify(
    [
      {
        title: "E2E 导入标题",
        slug,
        summary: "用于验证导入页闭环。",
        categorySlug: "programming",
        content: "请输出导入测试结论。",
      },
    ],
    null,
    2,
  );

  await page.goto("/admin/import");
  await page.getByLabel("JSON 内容").fill(payload);
  await page.getByRole("button", { name: "提交导入" }).click();
  await expect(page.getByRole("status")).toContainText("导入请求提交中");
  await expect(page.getByRole("status")).toContainText("导入成功");
  await expect(page.getByRole("status")).toContainText(slug);

  await page.getByLabel("JSON 内容").fill("{invalid json");
  await page.getByRole("button", { name: "提交导入" }).click();
  await expect(page.getByRole("status")).toContainText("JSON 解析失败");
});
