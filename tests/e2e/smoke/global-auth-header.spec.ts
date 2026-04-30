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

  await header.getByRole("button", { name: "退出" }).click();
  await expect(header.getByRole("link", { name: "登录" })).toBeVisible();
  await context.close();
});
