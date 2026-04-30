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

test("已登录普通用户访问 /admin/create 可进入投稿创建页", async ({ page }) => {
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

  await page.getByPlaceholder("用户名").fill("e2e-user");
  await page.getByPlaceholder("密码").fill("e2e-pass");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/admin\/create$/);
  await expect(page.getByRole("heading", { level: 1, name: "创建提示词" })).toBeVisible();
  await expect(page.getByRole("button", { name: "提交审核" })).toBeVisible();
});

test("普通用户提交创建后看到待审核反馈且首页不公开显示", async ({ page }) => {
  const token = createToken(false);
  test.skip(!token, "未配置 LOGIN_TOKEN_SECRET，无法生成登录 token。");

  const title = `E2E待审核投稿-${Date.now()}`;

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
          name: "E2E普通用户",
          department: "测试部",
          can_manage: false,
          can_manage_whitelist: false,
        },
        redirect: typeof body.redirect === "string" ? body.redirect : "/admin/create",
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

  await page.route("**/api/prompts", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        prompt: {
          slug: "e2e-pending-create",
          title,
          summary: "浏览器验收待审核摘要",
          status: "draft",
          categorySlug: "programming",
          categories: [{ slug: "programming", name: "编程" }],
          categorySlugs: ["programming"],
          currentVersion: {
            versionNo: "v0001",
            sourceType: "create",
          },
        },
        submission: {
          id: 10001,
          status: "pending",
        },
      }),
    });
  });

  await page.goto("/admin/create");
  await page.getByPlaceholder("用户名").fill("e2e-user");
  await page.getByPlaceholder("密码").fill("e2e-pass");
  await page.getByRole("button", { name: "登录" }).click();

  await page.getByLabel("标题").fill(title);
  await page.getByLabel("摘要").fill("浏览器验收待审核摘要");
  await page.getByLabel("编程").check();
  await page.getByLabel("内容").fill("普通用户提交后应等待管理员审核。");
  await page.getByRole("button", { name: "提交审核" }).click();

  await expect(page.getByRole("status")).toContainText("已提交");
  await expect(page.getByRole("status")).toContainText("通过后公开");

  await page.goto("/");
  await expect(page.getByText(title)).toHaveCount(0);
});
