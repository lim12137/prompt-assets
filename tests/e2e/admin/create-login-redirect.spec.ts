import { expect, test } from "@playwright/test";
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

function createToken(canManage: boolean): string {
  const secret = process.env.LOGIN_TOKEN_SECRET?.trim() || readSecretFromDotEnv();
  if (!secret) {
    return "";
  }
  return signLoginToken(
    {
      uid: "e2e-admin-create-redirect",
      name: "E2E管理员",
      department: "测试部",
      can_manage: canManage,
      can_manage_whitelist: false,
    },
    { secret },
  );
}

test("未登录访问 /admin/create 登录成功后回到创建页", async ({ page }) => {
  const token = createToken(true);
  test.skip(!token, "未配置 LOGIN_TOKEN_SECRET，无法生成登录 token。");

  await page.route("**/api/login", async (route) => {
    const body = route.request().postDataJSON() as { redirect?: unknown };
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": `auth_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=7200`,
      },
      body: JSON.stringify({
        user: {
          uid: "e2e-admin-create-redirect",
          name: "E2E管理员",
          department: "测试部",
          can_manage: true,
          can_manage_whitelist: false,
        },
        redirect: typeof body.redirect === "string" ? body.redirect : "/admin",
      }),
    });
  });

  await page.route("**/api/admin/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: [
          {
            slug: "programming",
            name: "编程",
            isSystem: false,
            isSelectable: true,
            isCollapsedByDefault: false,
            promptCount: 0,
          },
        ],
      }),
    });
  });

  await page.goto("/admin/create");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin%2Fcreate/);

  await page.getByPlaceholder("用户名").fill("e2e-admin");
  await page.getByPlaceholder("密码").fill("e2e-pass");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/admin\/create$/);
  await expect(page.getByRole("heading", { level: 1, name: "创建提示词" })).toBeVisible();
  await expect(page.getByLabel("标题")).toBeVisible();
});

test("已登录但无管理权限访问 /admin/create 不应再次回到登录页", async ({ page }) => {
  const token = createToken(false);
  test.skip(!token, "未配置 LOGIN_TOKEN_SECRET，无法生成登录 token。");

  await page.route("**/api/login", async (route) => {
    const body = route.request().postDataJSON() as { redirect?: unknown };
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": `auth_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=7200`,
      },
      body: JSON.stringify({
        user: {
          uid: "e2e-admin-create-redirect",
          name: "E2E管理员",
          department: "测试部",
          can_manage: false,
          can_manage_whitelist: false,
        },
        redirect: typeof body.redirect === "string" ? body.redirect : "/admin",
      }),
    });
  });

  await page.goto("/admin/create");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fadmin%2Fcreate/);

  await page.getByPlaceholder("用户名").fill("e2e-user");
  await page.getByPlaceholder("密码").fill("e2e-pass");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/admin\/create$/);
  await expect(page.getByRole("heading", { level: 1, name: "无管理权限" })).toBeVisible();
  await expect(page.getByRole("link", { name: "返回首页" })).toBeVisible();
});
