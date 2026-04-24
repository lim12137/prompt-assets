import { expect, test } from "@playwright/test";

type MockCategory = {
  slug: string;
  name: string;
  isSystem: boolean;
  isSelectable: boolean;
  isCollapsedByDefault: boolean;
  promptCount: number;
};

function createDefaultCategories(): MockCategory[] {
  return [
    {
      slug: "uncategorized",
      name: "待分类",
      isSystem: true,
      isSelectable: false,
      isCollapsedByDefault: true,
      promptCount: 1,
    },
    {
      slug: "programming",
      name: "编程",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 3,
    },
    {
      slug: "design",
      name: "设计",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 2,
    },
  ];
}

test("管理页展示分类管理区并可新增/删除（含预检查确认）", async ({ page }) => {
  let categories = createDefaultCategories();

  await page.route("**/api/admin/categories", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ categories }),
      });
      return;
    }
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { name?: string; slug?: string };
      const created: MockCategory = {
        slug: body.slug ?? "operations",
        name: body.name ?? "运营",
        isSystem: false,
        isSelectable: true,
        isCollapsedByDefault: false,
        promptCount: 0,
      };
      categories = [...categories, created];
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ category: created }),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/admin/categories/programming", async (route) => {
    const body = (route.request().postDataJSON() ?? {}) as {
      confirm?: boolean;
      confirmationToken?: string;
    };

    if (body.confirm === true) {
      categories = categories.filter((item) => item.slug !== "programming");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          deleted: true,
          slug: "programming",
          impactedPromptCount: 3,
          willBeUncategorizedCount: 1,
          autoAssignedUncategorizedCount: 1,
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dryRun: true,
        slug: "programming",
        impactedPromptCount: 3,
        willBeUncategorizedCount: 1,
        autoAssignedUncategorizedCount: 1,
        confirmationToken: "mock-token-programming",
        confirmationExpiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      }),
    });
  });

  await page.goto("/admin");

  await expect(page.getByRole("heading", { level: 2, name: "分类管理" })).toBeVisible();
  await expect(page.getByText("待分类")).toBeVisible();
  await expect(page.getByText("编程")).toBeVisible();

  await page.getByLabel("新增分类名称").fill("运营");
  await page.getByLabel("新增分类Slug").fill("operations");
  await page.getByRole("button", { name: "新增分类" }).click();
  await expect(page.getByRole("status")).toContainText("新增分类成功");
  await expect(page.getByTestId("admin-category-row-operations")).toContainText("运营");

  await page
    .locator("[data-testid='admin-category-row-programming']")
    .getByRole("button", { name: "删除" })
    .click();
  await expect(page.getByText("受影响提示词：3")).toBeVisible();
  await expect(page.getByText("将归入待分类：1")).toBeVisible();
  await page.getByRole("button", { name: "确认删除分类" }).click();
  await expect(page.getByRole("status")).toContainText("已删除分类");
  await expect(page.getByTestId("admin-category-row-programming")).toHaveCount(0);
});

test("管理创建页使用多选分类，且待分类不可手动选择", async ({ page }) => {
  let receivedBody: Record<string, unknown> | null = null;

  await page.route("**/api/admin/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories: createDefaultCategories() }),
    });
  });

  await page.route("**/api/prompts", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.continue();
      return;
    }

    receivedBody = request.postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        prompt: {
          slug: "internal-slug-only",
          title: "E2E 管理创建标题",
          summary: "用于验证管理员创建页闭环。",
          categorySlug: "programming",
          categorySlugs: ["programming", "design"],
          currentVersion: {
            versionNo: "v0001",
            sourceType: "create",
          },
        },
      }),
    });
  });

  await page.goto("/admin/create");
  await expect(page.getByLabel("分类（可多选）")).toBeVisible();
  await expect(page.getByLabel("待分类")).toBeDisabled();

  await page.getByLabel("标题").fill("E2E 管理创建标题");
  await page.getByLabel("摘要").fill("用于验证管理员创建页闭环。");
  await page.getByLabel("编程").check();
  await page.getByLabel("设计").check();
  await page.getByLabel("内容").fill("你是测试助手，请输出步骤和结果。");

  await page.getByRole("button", { name: "提交创建" }).click();
  await expect(page.getByRole("status")).toContainText("已创建");
  await expect(page.getByRole("status")).toContainText("E2E 管理创建标题");

  expect(receivedBody).not.toBeNull();
  expect(Array.isArray(receivedBody?.categorySlugs)).toBeTruthy();
  expect(receivedBody?.categorySlugs).toEqual(["programming", "design"]);
  expect(receivedBody?.categorySlug).toBeUndefined();
});

test("管理导入页示例与校验改为 categorySlugs[]", async ({ page }) => {
  let importRequestCount = 0;

  await page.route("**/api/admin/prompts/import", async (route) => {
    importRequestCount += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        total: 1,
        mode: "all_or_nothing",
        prompts: [
          {
            slug: "internal-import-slug",
            title: "E2E 导入标题",
            summary: "用于验证导入页闭环。",
            categorySlug: "programming",
            categorySlugs: ["programming", "design"],
            currentVersion: {
              versionNo: "v0001",
              sourceType: "create",
            },
          },
        ],
      }),
    });
  });

  await page.goto("/admin/import");
  const jsonInput = page.getByLabel("JSON 内容");
  await expect(jsonInput).toContainText("categorySlugs");

  await jsonInput.fill(
    JSON.stringify(
      [
        {
          title: "导入旧字段",
          summary: "使用 categorySlug 应被前端校验拒绝",
          categorySlug: "programming",
          content: "invalid import payload",
        },
      ],
      null,
      2,
    ),
  );
  await page.getByRole("button", { name: "提交导入" }).click();
  await expect(page.getByRole("status")).toContainText("categorySlugs 必须为非空数组");
  expect(importRequestCount).toBe(0);

  await jsonInput.fill(
    JSON.stringify(
      [
        {
          title: "导入待分类",
          summary: "待分类不能手动导入",
          categorySlugs: ["uncategorized"],
          content: "invalid uncategorized",
        },
      ],
      null,
      2,
    ),
  );
  await page.getByRole("button", { name: "提交导入" }).click();
  await expect(page.getByRole("status")).toContainText("待分类不能手动选择");
  expect(importRequestCount).toBe(0);

  await jsonInput.fill(
    JSON.stringify(
      [
        {
          title: "E2E 导入标题",
          summary: "用于验证导入页闭环。",
          categorySlugs: ["programming", "design"],
          content: "请输出导入测试结论。",
        },
      ],
      null,
      2,
    ),
  );
  await page.getByRole("button", { name: "提交导入" }).click();
  await expect(page.getByRole("status")).toContainText("导入成功");
  await expect(page.getByRole("status")).toContainText("E2E 导入标题");
  expect(importRequestCount).toBe(1);
});
