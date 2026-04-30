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

function createAuthToken(): string {
  const secret = process.env.LOGIN_TOKEN_SECRET?.trim() || readSecretFromDotEnv();
  if (!secret) {
    return "";
  }
  return signLoginToken(
    {
      uid: "e2e-loading-feedback",
      name: "加载反馈验收",
      department: "测试部",
      can_manage: true,
      can_manage_whitelist: false,
    },
    { secret },
  );
}

test("ux loading: 点击详情链接后立即显示页面加载反馈", async ({ page }) => {
  await page.route("**/prompts/js-code-reviewer**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });

  await page.goto("/");
  await page.getByLabel("关键词搜索").fill("JavaScript 代码审查助手");

  const clickPromise = page.getByRole("link", { name: "查看详情 →" }).first().click();

  await expect(page.locator(".pm-navigation-feedback.visible")).toContainText("页面加载中...");
  await clickPromise;
  await expect(page).toHaveURL(/\/prompts\/js-code-reviewer$/);
});

test("ux loading: 点击提示词卡片后立即显示页面加载反馈", async ({ page }) => {
  await page.route("**/prompts/js-code-reviewer**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });

  await page.goto("/");
  await page.getByLabel("关键词搜索").fill("JavaScript 代码审查助手");

  const card = page.locator("[data-testid='prompt-card']").filter({
    hasText: "JavaScript 代码审查助手",
  }).first();
  await expect(card).toBeVisible();

  const clickPromise = card.click({ position: { x: 12, y: 12 } });

  await expect(page.locator(".pm-navigation-feedback.visible")).toContainText("页面加载中...", {
    timeout: 250,
  });
  await clickPromise;
  await expect(page).toHaveURL(/\/prompts\/js-code-reviewer$/);
});

test("ux loading: 创建提交按钮 pending 期间禁用并给出明确等待文案", async ({ page }) => {
  const authToken = createAuthToken();
  test.skip(!authToken, "未配置 LOGIN_TOKEN_SECRET，无法生成登录 token。");

  await page.context().addCookies([
    {
      name: "auth_token",
      value: authToken,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await page.route("**/api/admin/categories", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        categories: [{ slug: "programming", name: "编程", isSelectable: true }],
      }),
    });
  });
  await page.route("**/api/prompts", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        prompt: {
          title: "Pending UX 验证",
          currentVersion: { versionNo: "v0001" },
        },
        submission: { status: "pending" },
      }),
    });
  });

  await page.goto("/admin/create");
  await page.getByLabel("标题").fill("Pending UX 验证");
  await page.getByLabel("摘要").fill("验证提交等待反馈");
  await page.getByLabel("分类（可多选）").getByLabel("编程").check();
  await page.getByLabel("内容").fill("等待反馈内容");

  const submitButton = page.getByRole("button", { name: "提交审核" });
  await submitButton.click();

  await expect(page.getByRole("button", { name: "正在提交审核..." })).toBeDisabled();
  await expect(page.getByRole("status", { name: "创建提交状态" })).toContainText(
    "审核请求提交中",
  );
});
