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
});

test("管理页在真实 DB 中完成 approve/reject 关键交互", async ({
  page,
}) => {
  await page.goto("/admin");
  const rows = page.locator('article[data-testid^="submission-row-"]');
  await expect(rows).toHaveCount(2);

  const firstRow = rows.first();
  const firstTitle = (await firstRow.getByRole("heading", { level: 2 }).textContent())?.trim();
  await firstRow.getByRole("button", { name: "通过" }).click();
  await expect(firstRow.getByRole("button", { name: "处理中..." })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    `已通过 ${firstTitle}`,
  );
  await expect(rows).toHaveCount(1);

  const remainingRow = rows.first();
  const remainingTitle = (
    await remainingRow.getByRole("heading", { level: 2 }).textContent()
  )?.trim();
  await remainingRow.getByRole("button", { name: "拒绝" }).click();
  await expect(remainingRow.getByRole("button", { name: "处理中..." })).toBeVisible();
  await expect(page.getByRole("status")).toContainText(
    `已拒绝 ${remainingTitle}`,
  );
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("当前没有待审核项")).toBeVisible();

  await page.reload();
  await expect(rows).toHaveCount(0);
});
