import { expect, test } from "@playwright/test";

test("首页创建/导入/管理入口均为可直达链接", async ({ page }) => {
  await page.goto("/");

  const importEntry = page.getByRole("link", { name: "导入" });
  const manageEntry = page.getByRole("link", { name: "管理" });
  const createEntry = page.getByRole("link", { name: "创建" });

  await expect(importEntry).toHaveAttribute("href", "/admin/import");
  await expect(manageEntry).toHaveAttribute("href", "/admin");
  await expect(createEntry).toHaveAttribute("href", "/admin/create");
  await expect(page.getByRole("status")).not.toContainText("暂未实现");

  await importEntry.click();
  await expect(page).toHaveURL(/\/admin\/import$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "批量导入提示词" }),
  ).toBeVisible();

  await page.goto("/");
  await createEntry.click();
  await expect(page).toHaveURL(/\/admin\/create$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "创建提示词" }),
  ).toBeVisible();

  await page.goto("/");
  await manageEntry.click();
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
