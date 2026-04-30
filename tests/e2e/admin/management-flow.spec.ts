import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signLoginToken } from "../../../apps/web/lib/auth/session.ts";

function readSecretFromDotEnv(): string {
  try {
    const content = readFileSync(join(process.cwd(), ".env"), "utf8");
    const line = content
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith("LOGIN_TOKEN_SECRET="));
    return line?.split("=")[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

function createAdminToken(): string {
  const secret = process.env.LOGIN_TOKEN_SECRET?.trim() || readSecretFromDotEnv();
  if (!secret) {
    return "";
  }
  return signLoginToken(
    {
      uid: "e2e-admin-back-link",
      name: "E2E管理员",
      department: "测试部",
      can_manage: true,
      can_manage_whitelist: false,
    },
    { secret },
  );
}

async function addAdminCookie(page: Page) {
  const token = createAdminToken();
  test.skip(!token, "未配置 LOGIN_TOKEN_SECRET，无法生成登录 token。");

  await page.context().addCookies([
    {
      name: "auth_token",
      value: token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test("首页创建/导入/管理入口均为可直达链接", async ({ page }) => {
  await addAdminCookie(page);

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

test("管理页、创建页和导入页返回入口与详情页模式保持一致", async ({ page }) => {
  await addAdminCookie(page);

  await page.route("**/api/admin/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ categories: [] }),
    });
  });

  await page.goto("/admin");
  const managementBack = page.getByRole("link", { name: "返回首页" });
  await expect(managementBack).toHaveAttribute("href", "/");
  await expect(managementBack).toHaveClass(/pm-back-button/);
  await expect(page.locator("main").locator("> a.pm-back-button")).toHaveCount(1);

  await page.goto("/admin/create");
  const createBack = page.getByRole("link", { name: "返回首页" });
  await expect(createBack).toHaveAttribute("href", "/");
  await expect(createBack).toHaveClass(/pm-back-button/);
  await expect(page.locator("main").locator("> a.pm-back-button")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "返回管理页" })).toHaveCount(0);

  await page.goto("/admin/import");
  const importBack = page.getByRole("link", { name: "返回首页" });
  await expect(importBack).toHaveAttribute("href", "/");
  await expect(importBack).toHaveClass(/pm-back-button/);
  await expect(page.locator("main").locator("> a.pm-back-button")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "返回管理页" })).toHaveCount(0);
});

test("管理页在真实 DB 中完成 approve/reject 关键交互", async ({
  page,
}) => {
  await addAdminCookie(page);

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
