import { expect, test } from "@playwright/test";
import { createAdminLoginToken } from "../auth-helpers";

test("登录页展示有度一体化平台账号登录并保留 redirect 登录回跳", async ({ page }) => {
  const token = createAdminLoginToken("e2e-login-page");
  test.skip(!token, "未配置 LOGIN_TOKEN_SECRET，无法生成登录 token。");

  await page.route("**/api/login", async (route) => {
    const body = route.request().postDataJSON() as {
      username?: unknown;
      password?: unknown;
      redirect?: unknown;
    };

    expect(body.username).toBe("e2e-user");
    expect(body.password).toBe("e2e-pass");
    expect(body.redirect).toBe("/admin/create");

    await route.fulfill({
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": `auth_token=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=7200`,
      },
      body: JSON.stringify({
        user: {
          uid: "e2e-login-page",
          name: "E2E管理员",
          department: "测试部",
          can_manage: true,
          can_manage_whitelist: false,
        },
        redirect: "/admin/create",
      }),
    });
  });

  await page.goto("/login?redirect=%2Fadmin%2Fcreate");

  await expect(page.getByRole("heading", { level: 1, name: "有度一体化平台账号登录" })).toBeVisible();
  await expect(page.getByText("请输入有度一体化平台账号与密码")).toBeVisible();
  await expect(page.getByRole("button", { name: "账号密码登录" })).toBeVisible();
  await expect(page.getByPlaceholder("请输入有度一体化平台账号")).toBeVisible();
  await expect(page.getByPlaceholder("请输入账号密码")).toBeVisible();

  await page.getByPlaceholder("请输入有度一体化平台账号").fill("e2e-user");
  await page.getByPlaceholder("请输入账号密码").fill("e2e-pass");
  await page.getByRole("button", { name: "登录并进入系统" }).click();

  await expect(page).toHaveURL(/\/admin\/create$/);
});
