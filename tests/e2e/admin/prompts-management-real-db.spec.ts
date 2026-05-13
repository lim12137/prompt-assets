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

async function selectFirstAvailableCategoryOnCreate(page: Page) {
  const candidate = page
    .locator('fieldset[aria-label="分类（可多选）"] input[type="checkbox"]:not([disabled])')
    .first();
  await candidate.check();
}

async function createPublishedPrompt(page: Page, input: {
  title: string;
  summary: string;
  content: string;
  categoryNames: string[];
}) {
  const slug = generateSlugFromTitle(input.title);

  await page.goto("/admin/create");
  await page.getByLabel("标题").fill(input.title);
  await page.getByLabel("摘要").fill(input.summary);
  if (input.categoryNames.length === 0) {
    await selectFirstAvailableCategoryOnCreate(page);
  } else {
    for (const categoryName of input.categoryNames) {
      await page.getByLabel(categoryName).check();
    }
  }
  await page.getByRole("textbox", { name: "内容" }).fill(input.content);
  await page.getByRole("button", { name: "提交审核" }).click();

  const createStatus = page.getByRole("status");
  await expect(createStatus).toContainText("审核请求提交中");
  await expect(createStatus).toContainText("已创建");
  await expect(createStatus).toContainText(input.title);

  return { slug };
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

test("真实 DB: 列表页批量增加/删除分类并局部更新", async ({ page }) => {
  await addAdminCookie(page);
  const marker = Date.now();
  const promptA = await createPublishedPrompt(page, {
    title: `真实DB批量分类A-${marker}`,
    summary: "真实 DB 批量分类样本 A。",
    content: `真实 DB 批量分类正文 A ${marker}`,
    categoryNames: ["编程"],
  });
  const promptB = await createPublishedPrompt(page, {
    title: `真实DB批量分类B-${marker}`,
    summary: "真实 DB 批量分类样本 B。",
    content: `真实 DB 批量分类正文 B ${marker}`,
    categoryNames: ["编程"],
  });

  await page.goto("/admin/prompts");
  await page.getByLabel("关键词").fill(`真实db批量分类`);
  const rowA = page.getByTestId(`admin-prompts-row-${promptA.slug}`);
  const rowB = page.getByTestId(`admin-prompts-row-${promptB.slug}`);
  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();
  const addCategoryName = "设计";
  const removeCategoryName = "编程";

  await page.getByLabel(`选择提示词 真实DB批量分类A-${marker}`).check();
  await page.getByLabel(`选择提示词 真实DB批量分类B-${marker}`).check();
  await page.getByTestId("admin-prompts-bulk-action-bar").getByRole("button", { name: "批量增加分类" }).click();
  await page.getByLabel(addCategoryName).check();
  await page.getByRole("button", { name: "确认增加分类" }).click();

  await expect(page.getByRole("status")).toContainText("已批量增加分类");
  await expect(rowA).toContainText(addCategoryName);
  await expect(rowB).toContainText(addCategoryName);

  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();
  await expect(rowA).toContainText(addCategoryName);
  await expect(rowB).toContainText(addCategoryName);

  await page.getByLabel(`选择提示词 真实DB批量分类A-${marker}`).check();
  await page.getByLabel(`选择提示词 真实DB批量分类B-${marker}`).check();
  await page.getByTestId("admin-prompts-bulk-action-bar").getByRole("button", { name: "批量删除分类" }).click();
  await page.getByLabel(removeCategoryName).check();
  await page.getByRole("button", { name: "确认删除分类" }).click();

  await expect(page.getByRole("status")).toContainText("已批量删除分类");
  await expect(rowA).not.toContainText(removeCategoryName);
  await expect(rowB).not.toContainText(removeCategoryName);
  await expect(rowA).toContainText(addCategoryName);
  await expect(rowB).toContainText(addCategoryName);

  const refreshResponse = await page.request.get(
    "/api/admin/prompts",
  );
  const refreshPayload = (await refreshResponse.json()) as {
    prompts?: Array<{
      title: string;
      slug: string;
      categories: Array<{ slug: string; name: string }>;
      categorySlugs: string[];
    }>;
  };
  const refreshedA = refreshPayload.prompts?.find((item) => item.slug === promptA.slug);
  const refreshedB = refreshPayload.prompts?.find((item) => item.slug === promptB.slug);
  expect(refreshResponse.ok()).toBe(true);
  expect(refreshedA?.categories.some((item) => item.name === removeCategoryName)).toBe(false);
  expect(refreshedB?.categories.some((item) => item.name === removeCategoryName)).toBe(false);
  expect(refreshedA?.categories.some((item) => item.name === addCategoryName)).toBe(true);
  expect(refreshedB?.categories.some((item) => item.name === addCategoryName)).toBe(true);
});

test("真实 DB: 列表页支持二段式批量删除提示词并保持当前筛选", async ({ page }) => {
  await addAdminCookie(page);
  const marker = Date.now();
  const promptA = await createPublishedPrompt(page, {
    title: `真实DB批量删除A-${marker}`,
    summary: "真实 DB 批量删除样本 A。",
    content: `真实 DB 批量删除正文 A ${marker}`,
    categoryNames: [],
  });
  const promptB = await createPublishedPrompt(page, {
    title: `真实DB批量删除B-${marker}`,
    summary: "真实 DB 批量删除样本 B。",
    content: `真实 DB 批量删除正文 B ${marker}`,
    categoryNames: [],
  });

  await page.addInitScript(() => {
    window.__pmPageLoadCount = (window.__pmPageLoadCount ?? 0) + 1;
  });
  await page.goto("/admin/prompts");
  await page.getByRole("button", { name: "仅看已发布" }).click();
  await page.getByLabel("关键词").fill(`真实db批量删除`);
  const beforeUrl = page.url();
  const beforeLoadCount = await page.evaluate(() => window.__pmPageLoadCount ?? 0);

  const rowA = page.getByTestId(`admin-prompts-row-${promptA.slug}`);
  const rowB = page.getByTestId(`admin-prompts-row-${promptB.slug}`);
  await expect(rowA).toBeVisible();
  await expect(rowB).toBeVisible();

  await page.getByLabel(`选择提示词 真实DB批量删除A-${marker}`).check();
  await page.getByLabel(`选择提示词 真实DB批量删除B-${marker}`).check();
  await page.getByTestId("admin-prompts-bulk-action-bar").getByRole("button", { name: "批量删除提示词" }).click();

  await expect(page.getByText("删除后不可恢复")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("批量删除预检查完成");

  await page.getByRole("button", { name: "确认删除提示词" }).click();
  await expect(page.getByRole("status")).toContainText("已批量删除提示词（2 项）");
  await expect(rowA).toHaveCount(0);
  await expect(rowB).toHaveCount(0);
  await expect(page.getByTestId("admin-prompts-bulk-action-bar")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "当前筛选下没有提示词" })).toBeVisible();
  await expect(page.getByRole("button", { name: "仅看已发布" })).toHaveClass(
    /pm-filter-button-active/,
  );
  await expect(page.getByLabel("关键词")).toHaveValue("真实db批量删除");
  await expect(page).toHaveURL(beforeUrl);
  const afterLoadCount = await page.evaluate(() => window.__pmPageLoadCount ?? 0);
  expect(afterLoadCount).toBe(beforeLoadCount);

  const refreshResponse = await page.request.get("/api/admin/prompts");
  const refreshPayload = (await refreshResponse.json()) as {
    prompts?: Array<{ slug: string }>;
  };
  expect(refreshResponse.ok()).toBe(true);
  expect(refreshPayload.prompts?.some((item) => item.slug === promptA.slug)).toBe(false);
  expect(refreshPayload.prompts?.some((item) => item.slug === promptB.slug)).toBe(false);
});
