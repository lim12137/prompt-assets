import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signLoginToken } from "../../../apps/web/lib/auth/session.ts";

function readAuthCookieFromEnv(): string {
  const raw = process.env.E2E_AUTH_COOKIE?.trim() ?? "";
  if (!raw) {
    return "";
  }
  if (raw.startsWith("auth_token=")) {
    return raw.slice("auth_token=".length);
  }
  return raw;
}

function readSecretFromDotEnv(): string {
  try {
    const envPath = join(process.cwd(), ".env");
    const content = readFileSync(envPath, "utf8");
    const line = content
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith("LOGIN_TOKEN_SECRET="));
    if (!line) {
      return "";
    }
    const raw = line.split("=")[1] ?? "";
    return raw.trim();
  } catch {
    return "";
  }
}

function resolveE2eAuthToken(): string {
  const fromEnv = readAuthCookieFromEnv();
  if (fromEnv) {
    return fromEnv;
  }
  const secret = process.env.LOGIN_TOKEN_SECRET?.trim() || readSecretFromDotEnv();
  if (!secret) {
    return "";
  }
  return signLoginToken(
    {
      uid: "e2e-user-1001",
      name: "E2E用户",
      department: "安全部",
      can_manage: true,
      can_manage_whitelist: false,
    },
    { secret },
  );
}

test("未登录时右上显示登录且链接保留当前路径", async ({ page }) => {
  await page.goto("/prompts/js-code-reviewer");
  const loginLink = page.locator("[data-testid='global-auth-header']").getByRole("link", {
    name: "登录",
  });
  await expect(loginLink).toBeVisible();
  await expect(loginLink).toHaveAttribute(
    "href",
    "/login?redirect=%2Fprompts%2Fjs-code-reviewer",
  );
});

test("已登录时右上显示用户标识并提供退出入口", async ({ browser }) => {
  const authCookie = resolveE2eAuthToken();
  test.skip(!authCookie, "未提供可用登录 cookie 且无法生成 token。");

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "auth_token",
      value: authCookie,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto("/");

  const header = page.locator("[data-testid='global-auth-header']");
  await expect(header.getByRole("link", { name: "登录" })).toHaveCount(0);
  await expect(header.getByText("退出")).toBeVisible();
  await expect(header.locator(".pm-auth-user-id")).toBeVisible();
  await expect(header.locator(".pm-auth-user-id")).toContainText("E2E用户 / 安全部");

  const logoutRequestPromise = page.waitForRequest((request) => {
    return request.method() === "POST" && request.url().includes("/api/logout");
  });
  const logoutResponsePromise = page.waitForResponse((response) => {
    return response.request().method() === "POST" && response.url().includes("/api/logout");
  });

  const beforeLogout = Date.now();
  await header.getByRole("button", { name: "退出" }).click();
  const logoutRequest = await logoutRequestPromise;
  const logoutResponse = await logoutResponsePromise;
  const logoutDurationMs = Date.now() - beforeLogout;

  expect(logoutRequest).toBeTruthy();
  expect(logoutResponse.ok()).toBeTruthy();
  expect(logoutDurationMs).toBeLessThan(10_000);
  await context.close();
});

test("点击退出后当前页头部应在 1 秒内恢复登录态", async ({ browser }) => {
  const authCookie = resolveE2eAuthToken();
  test.skip(!authCookie, "未提供可用登录 cookie 且无法生成 token。");

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "auth_token",
      value: authCookie,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto("/prompts/js-code-reviewer");

  const header = page.locator("[data-testid='global-auth-header']");
  await expect(header.getByRole("button", { name: "退出" })).toBeVisible();

  const startedAt = Date.now();
  await header.getByRole("button", { name: "退出" }).click();
  await expect(header.getByRole("link", { name: "登录" })).toBeVisible({ timeout: 1_000 });
  const elapsedMs = Date.now() - startedAt;
  expect(elapsedMs).toBeLessThan(1_000);
  await context.close();
});

test("已登录且无部门时仅显示姓名，不显示 undefined/null", async ({ browser }) => {
  const secret = process.env.LOGIN_TOKEN_SECRET?.trim() || readSecretFromDotEnv();
  test.skip(!secret, "未配置 LOGIN_TOKEN_SECRET，无法生成 token。");
  const authCookie = signLoginToken(
    {
      uid: "e2e-user-nodept",
      name: "无部门用户",
      can_manage: false,
      can_manage_whitelist: false,
    },
    { secret },
  );

  const context = await browser.newContext();
  await context.addCookies([
    {
      name: "auth_token",
      value: authCookie,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const page = await context.newPage();
  await page.goto("/");

  const identity = page.locator("[data-testid='global-auth-header'] .pm-auth-user-id");
  await expect(identity).toContainText("无部门用户");
  await expect(identity).not.toContainText("undefined");
  await expect(identity).not.toContainText("null");
  await context.close();
});

test("登录成功后回到原页面时右上角立即刷新为已登录态", async ({ page }) => {
  const authCookie = resolveE2eAuthToken();
  test.skip(!authCookie, "未提供可用登录 cookie 且无法生成 token。");

  await page.addInitScript(
    ({ token }) => {
      const originalFetch = window.fetch.bind(window);
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        if (typeof input === "string" && input === "/api/login") {
          document.cookie = `auth_token=${token}; Path=/; SameSite=Lax`;
          return new Response(
            JSON.stringify({
              user: {
                uid: "e2e-user-1001",
                name: "E2E用户",
                department: "安全部",
                can_manage: true,
                can_manage_whitelist: false,
              },
              redirect: "/prompts/js-code-reviewer",
            }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        }
        return originalFetch(input, init);
      };
    },
    { token: authCookie },
  );

  await page.goto("/prompts/js-code-reviewer");
  await page
    .locator("[data-testid='global-auth-header']")
    .getByRole("link", { name: "登录" })
    .click();
  await expect(page).toHaveURL(/\/login\?redirect=%2Fprompts%2Fjs-code-reviewer/);
  await page.waitForTimeout(1000);

  await page.getByPlaceholder("用户名").fill("e2e-user");
  await page.getByPlaceholder("密码").fill("e2e-pass");
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/prompts\/js-code-reviewer/);
  const header = page.locator("[data-testid='global-auth-header']");
  await expect(header.getByRole("link", { name: "登录" })).toHaveCount(0);
  await expect(header.locator(".pm-auth-user-id")).toContainText("E2E用户 / 安全部");
  await expect(header.getByRole("button", { name: "退出" })).toBeVisible();
});
