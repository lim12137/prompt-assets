import { expect, test, type Page } from "@playwright/test";
import { signLoginToken } from "../../../apps/web/lib/auth/session.ts";
import { requireWorkspaceEnvValue } from "../../../scripts/workspace-env.mjs";

function generateSlugFromTitle(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (normalized) {
    return normalized;
  }

  let hash = 0;
  for (const char of title) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000000007;
  }
  return `prompt-${Math.abs(hash)}`;
}

function createAdminToken(): string {
  const secret = requireWorkspaceEnvValue("LOGIN_TOKEN_SECRET", {
    cwd: process.cwd(),
    env: process.env,
  });
  return signLoginToken(
    {
      uid: "e2e-admin-prompts-real-db",
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

test("真实 DB: 管理员进入提示词管理页并完成归档链路", async ({ page }) => {
  const marker = Date.now();
  const title = `真实DB管理归档提示词-${marker}`;
  const slug = generateSlugFromTitle(title);

  await addAdminCookie(page);

  await page.goto("/admin/create");
  await page.getByLabel("标题").fill(title);
  await page.getByLabel("摘要").fill("真实 DB 管理页归档链路回归摘要。");
  await page.getByLabel("编程").check();
  await page.getByRole("textbox", { name: "内容" }).fill(`真实 DB 管理页归档正文 ${marker}`);
  await page.getByRole("button", { name: "提交审核" }).click();

  const createStatus = page.getByRole("status");
  await expect(createStatus).toContainText("审核请求提交中");
  await expect(createStatus).toContainText("已创建");
  await expect(createStatus).toContainText(title);

  await page.goto("/admin/prompts");
  await expect(page.getByRole("heading", { level: 1, name: "提示词管理" })).toBeVisible();

  const keywordInput = page.getByLabel("关键词");
  await keywordInput.fill(slug);

  const row = page.getByTestId(`admin-prompts-row-${slug}`);
  await expect(row).toBeVisible();
  await expect(row).toContainText(title);
  await expect(row).toContainText("已发布");

  await row.getByRole("button", { name: "归档" }).click();

  const managementStatus = page.getByRole("status");
  await expect(managementStatus).toContainText(`已归档 ${title}`);
  await expect(row).toContainText("已归档");

  await page.reload();
  await keywordInput.fill(slug);
  await expect(row).toBeVisible();
  await expect(row).toContainText("已归档");
});
