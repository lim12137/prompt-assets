import { expect, test } from "@playwright/test";

test("首页管理入口跳转到真实管理页，未实现按钮给出明确反馈", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "导入" }).click();
  await expect(page.getByRole("status")).toContainText("导入功能暂未实现");

  await page.getByRole("button", { name: "创建" }).click();
  await expect(page.getByRole("status")).toContainText("创建功能暂未实现");

  await page.getByRole("link", { name: "管理" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "待审核管理" }),
  ).toBeVisible();
  await expect(page.getByText("JavaScript 代码审查助手")).toBeVisible();
  await expect(page.getByText("落地页文案框架")).toBeVisible();
});

test("管理页审核通过时展示处理中和成功反馈，并移除已处理项", async ({
  page,
}) => {
  await page.route("**/api/admin/submissions/1/approve", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        submission: {
          id: 1,
          status: "approved",
          reviewComment: "内容完整，可以发布",
          reviewedByEmail: "admin@example.com",
        },
        prompt: {
          slug: "js-code-reviewer",
          currentVersion: {
            versionNo: "v0002",
          },
        },
        candidateVersion: {
          versionNo: "v0002",
        },
      }),
    });
  });

  await page.goto("/admin");
  const row = page.getByTestId("submission-row-1");

  await row.getByRole("button", { name: "通过" }).click();
  await expect(row.getByRole("button", { name: "处理中..." })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("已通过 JavaScript 代码审查助手");
  await expect(page.getByTestId("submission-row-1")).toHaveCount(0);
});

test("管理页审核拒绝失败时展示错误反馈并保留待审核项", async ({ page }) => {
  await page.route("**/api/admin/submissions/2/reject", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({
        error: "submission is not pending",
      }),
    });
  });

  await page.goto("/admin");
  const row = page.getByTestId("submission-row-2");

  await row.getByRole("button", { name: "拒绝" }).click();
  await expect(row.getByRole("button", { name: "处理中..." })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    "落地页文案框架 审核失败：submission is not pending",
  );
  await expect(page.getByTestId("submission-row-2")).toBeVisible();
});
