import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { signLoginToken } from "../../apps/web/lib/auth/session.ts";

type LoginUser = {
  uid: string;
  name: string;
  department?: string;
  can_manage: boolean;
  can_manage_whitelist: boolean;
};

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

export function resolveLoginSecret(): string {
  return process.env.LOGIN_TOKEN_SECRET?.trim() || readSecretFromDotEnv();
}

export function createLoginToken(user: LoginUser): string {
  const secret = resolveLoginSecret();
  if (!secret) {
    return "";
  }
  return signLoginToken(user, { secret });
}

export async function addAuthCookie(page: Page, token: string): Promise<void> {
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

export function createAdminLoginToken(uid: string, name = "E2E管理员"): string {
  return createLoginToken({
    uid,
    name,
    department: "测试部",
    can_manage: true,
    can_manage_whitelist: false,
  });
}

export function createEmployeeLoginToken(uid: string, name = "E2E员工"): string {
  return createLoginToken({
    uid,
    name,
    department: "测试部",
    can_manage: false,
    can_manage_whitelist: false,
  });
}
