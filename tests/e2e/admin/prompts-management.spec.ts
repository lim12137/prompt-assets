import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signLoginToken } from "../../../apps/web/lib/auth/session.ts";

type PromptStatus = "draft" | "published" | "archived";

type ManagedPrompt = {
  slug: string;
  title: string;
  summary: string;
  status: PromptStatus;
  updatedAt: string;
  category: {
    slug: string;
    name: string;
  };
  categories: Array<{
    slug: string;
    name: string;
  }>;
  categorySlugs: string[];
};

type ManagedCategory = {
  slug: string;
  name: string;
  isSystem: boolean;
  isSelectable: boolean;
  isCollapsedByDefault: boolean;
  promptCount: number;
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

function createAdminToken(): string {
  const secret = process.env.LOGIN_TOKEN_SECRET?.trim() || readSecretFromDotEnv();
  if (!secret) {
    return "";
  }
  return signLoginToken(
    {
      uid: "e2e-admin-prompts",
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

function createPromptRecord(input: {
  slug: string;
  title: string;
  summary: string;
  status: PromptStatus;
  categorySlugs: string[];
  categories: ManagedPrompt["categories"];
}): ManagedPrompt {
  const category = input.categories[0] ?? {
    slug: input.categorySlugs[0] ?? "",
    name: "",
  };

  return {
    slug: input.slug,
    title: input.title,
    summary: input.summary,
    status: input.status,
    updatedAt: "2026-05-01T09:30:00.000Z",
    category,
    categories: input.categories,
    categorySlugs: input.categorySlugs,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function setupPromptManagementRoutes(
  page: Page,
  options?: {
    onPromptsListRequest?: (url: URL) => void | Promise<void>;
    onBatchCategoriesRequest?: () => void | Promise<void>;
    onBatchDeleteRequest?: (payload: {
      slugs?: string[];
      dryRun?: boolean;
      confirm?: boolean;
      confirmationToken?: string;
    }) => void | Promise<void>;
    waitForBatchCategoriesResponse?: Promise<void>;
  },
) {
  const categories: ManagedCategory[] = [
    {
      slug: "content-creation",
      name: "内容创作",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 3,
    },
    {
      slug: "programming",
      name: "编程",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 5,
    },
    {
      slug: "design",
      name: "设计",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 4,
    },
    {
      slug: "uncategorized",
      name: "待分类",
      isSystem: true,
      isSelectable: false,
      isCollapsedByDefault: true,
      promptCount: 1,
    },
  ];

  const promptStore = new Map<string, ManagedPrompt>([
    [
      "alpha-prompt",
      createPromptRecord({
        slug: "alpha-prompt",
        title: "Alpha Prompt",
        summary: "用于验证已发布列表操作。",
        status: "published",
        categorySlugs: ["programming"],
        categories: [{ slug: "programming", name: "编程" }],
      }),
    ],
    [
      "beta-prompt",
      createPromptRecord({
        slug: "beta-prompt",
        title: "Beta Prompt",
        summary: "用于验证已归档列表操作。",
        status: "archived",
        categorySlugs: ["design"],
        categories: [{ slug: "design", name: "设计" }],
      }),
    ],
    [
      "gamma-prompt",
      createPromptRecord({
        slug: "gamma-prompt",
        title: "Gamma Prompt",
        summary: "用于验证重新分类与删除。",
        status: "published",
        categorySlugs: ["uncategorized"],
        categories: [{ slug: "uncategorized", name: "待分类" }],
      }),
    ],
  ]);

  let deletePreviewToken = "delete-token-gamma";

  await page.route("**/api/admin/categories", async (route) => {
    await fulfillJson(route, { categories });
  });

  await page.route("**/api/admin/prompts?**", async (route) => {
    const url = new URL(route.request().url());
    await options?.onPromptsListRequest?.(url);
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    const keyword = (url.searchParams.get("keyword") ?? "").trim().toLowerCase();

    const prompts = [...promptStore.values()]
      .filter((item) => (status ? item.status === status : true))
      .filter((item) => (category ? item.categorySlugs.includes(category) : true))
      .filter((item) => {
        if (!keyword) {
          return true;
        }
        return (
          item.slug.toLowerCase().includes(keyword) ||
          item.title.toLowerCase().includes(keyword) ||
          item.summary.toLowerCase().includes(keyword)
        );
      });

    await fulfillJson(route, { prompts });
  });

  await page.route("**/api/admin/prompts/alpha-prompt/archive", async (route) => {
    const prompt = promptStore.get("alpha-prompt");
    if (!prompt) {
      await fulfillJson(route, { error: "prompt not found" }, 404);
      return;
    }
    const updated = { ...prompt, status: "archived" as const };
    promptStore.set(updated.slug, updated);
    await fulfillJson(route, { prompt: updated });
  });

  await page.route("**/api/admin/prompts/beta-prompt/restore", async (route) => {
    const prompt = promptStore.get("beta-prompt");
    if (!prompt) {
      await fulfillJson(route, { error: "prompt not found" }, 404);
      return;
    }
    const updated = { ...prompt, status: "published" as const };
    promptStore.set(updated.slug, updated);
    await fulfillJson(route, { prompt: updated });
  });

  await page.route("**/api/admin/prompts/gamma-prompt", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as {
      categorySlugs?: string[];
    };
    const prompt = promptStore.get("gamma-prompt");
    if (!prompt) {
      await fulfillJson(route, { error: "prompt not found" }, 404);
      return;
    }

    const nextCategorySlugs = Array.isArray(payload.categorySlugs)
      ? payload.categorySlugs.filter(Boolean).filter((slug, index, all) => all.indexOf(slug) === index)
      : [];
    const nextCategories = categories
      .filter((item) => nextCategorySlugs.includes(item.slug))
      .map((item) => ({ slug: item.slug, name: item.name }));

    if (nextCategories.length === 0) {
      await fulfillJson(route, { error: "categorySlugs must include at least one category" }, 400);
      return;
    }

    const updated: ManagedPrompt = {
      ...prompt,
      category: nextCategories[0],
      categories: nextCategories,
      categorySlugs: nextCategorySlugs.filter((slug) => slug !== "uncategorized"),
    };
    promptStore.set(updated.slug, updated);
    await fulfillJson(route, { prompt: updated });
  });

  await page.route("**/api/admin/prompts/gamma-prompt/delete", async (route) => {
    const payload = route.request().postDataJSON() as {
      confirm?: boolean;
      confirmationToken?: string;
    };

    if (!payload?.confirm) {
      await fulfillJson(route, {
        dryRun: true,
        slug: "gamma-prompt",
        title: "Gamma Prompt",
        status: "published",
        category: {
          slug: "content-creation",
          name: "内容创作",
        },
        categories: [{ slug: "content-creation", name: "内容创作" }],
        relatedCounts: {
          versions: 2,
          submissions: 1,
          likes: 3,
          versionLikes: 1,
          versionScores: 2,
          dailyInteractions: 1,
        },
        confirmationToken: deletePreviewToken,
        confirmationExpiresAt: "2026-05-01T10:00:00.000Z",
      });
      return;
    }

    if (payload.confirmationToken !== deletePreviewToken) {
      await fulfillJson(route, { error: "invalid confirmation token" }, 400);
      return;
    }

    promptStore.delete("gamma-prompt");
    await fulfillJson(route, {
      deleted: true,
      slug: "gamma-prompt",
      deletedCounts: {
        versions: 2,
        submissions: 1,
        likes: 3,
        versionLikes: 1,
        versionScores: 2,
        dailyInteractions: 1,
      },
    });
  });

  await page.route("**/api/admin/prompts/batch-categories", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }
    await options?.onBatchCategoriesRequest?.();
    await options?.waitForBatchCategoriesResponse;
    const payload = route.request().postDataJSON() as {
      slugs?: string[];
      addCategorySlugs?: string[];
      removeCategorySlugs?: string[];
    };
    const slugs = Array.isArray(payload.slugs) ? payload.slugs : [];
    const addCategorySlugs = Array.isArray(payload.addCategorySlugs)
      ? payload.addCategorySlugs
      : [];
    const removeCategorySlugs = Array.isArray(payload.removeCategorySlugs)
      ? payload.removeCategorySlugs
      : [];

    const prompts = slugs
      .map((slug) => promptStore.get(slug))
      .filter((item): item is ManagedPrompt => Boolean(item))
      .map((prompt) => {
        const merged = prompt.categorySlugs
          .filter((slug) => !removeCategorySlugs.includes(slug))
          .concat(addCategorySlugs)
          .filter((slug, index, all) => slug && all.indexOf(slug) === index);
        const fallback = merged.length > 0 ? merged : ["uncategorized"];
        const nextCategories = categories
          .filter((item) => fallback.includes(item.slug))
          .map((item) => ({ slug: item.slug, name: item.name }));
        const updated: ManagedPrompt = {
          ...prompt,
          category: nextCategories[0] ?? { slug: "uncategorized", name: "待分类" },
          categories: nextCategories,
          categorySlugs: fallback,
        };
        promptStore.set(updated.slug, updated);
        return updated;
      });

    await fulfillJson(route, { prompts });
  });

  await page.route("**/api/admin/prompts/batch-delete", async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as {
      slugs?: string[];
      dryRun?: boolean;
      confirm?: boolean;
      confirmationToken?: string;
    };
    await options?.onBatchDeleteRequest?.(payload);

    const slugs = Array.isArray(payload.slugs) ? payload.slugs : [];
    if (payload.dryRun === true) {
      const foundPrompts = slugs
        .map((slug) => promptStore.get(slug))
        .filter((item): item is ManagedPrompt => Boolean(item))
        .map((item) => ({
          slug: item.slug,
          title: item.title,
          status: item.status,
          primaryCategory: item.categories[0] ?? { slug: "uncategorized", name: "待分类" },
          categories: item.categories,
          relatedCounts: {
            versions: 1,
            submissions: 0,
            likes: 0,
            versionLikes: 0,
            versionScores: 0,
            dailyInteractions: 0,
          },
        }));
      await fulfillJson(route, {
        dryRun: true,
        slugs,
        foundPrompts,
        summary: {
          versions: foundPrompts.length,
          submissions: 0,
          likes: 0,
          versionLikes: 0,
          versionScores: 0,
          dailyInteractions: 0,
        },
        confirmationToken: "batch-delete-token",
        confirmationExpiresAt: "2026-05-01T10:00:00.000Z",
      });
      return;
    }

    if (payload.confirm === true && payload.confirmationToken === "batch-delete-token") {
      for (const slug of slugs) {
        promptStore.delete(slug);
      }
      await fulfillJson(route, {
        deleted: true,
        slugs,
        deletedCounts: {
          versions: slugs.length,
          submissions: 0,
          likes: 0,
          versionLikes: 0,
          versionScores: 0,
          dailyInteractions: 0,
        },
      });
      return;
    }

    await fulfillJson(route, { error: "invalid confirmation token" }, 400);
  });
}

async function setupLongPromptListRoutes(page: Page) {
  const categories: ManagedCategory[] = [
    {
      slug: "programming",
      name: "编程",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 30,
    },
    {
      slug: "design",
      name: "设计",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 10,
    },
  ];

  const promptStore = new Map<string, ManagedPrompt>();
  for (let index = 1; index <= 30; index += 1) {
    const slug = `long-prompt-${String(index).padStart(2, "0")}`;
    promptStore.set(
      slug,
      createPromptRecord({
        slug,
        title: `Long Prompt ${index}`,
        summary: `用于验证长列表下浮动条表现的提示词 ${index}。`,
        status: "published",
        categorySlugs: [index % 2 === 0 ? "design" : "programming"],
        categories: [
          {
            slug: index % 2 === 0 ? "design" : "programming",
            name: index % 2 === 0 ? "设计" : "编程",
          },
        ],
      }),
    );
  }

  await page.route("**/api/admin/categories", async (route) => {
    await fulfillJson(route, { categories });
  });

  await page.route("**/api/admin/prompts?**", async (route) => {
    await fulfillJson(route, { prompts: [...promptStore.values()] });
  });
}

test("后台提示词管理列表支持归档与恢复", async ({ page }) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts");

  await expect(page.getByRole("heading", { level: 1, name: "提示词管理" })).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toContainText("已发布");
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toContainText("已归档");

  await page.getByTestId("admin-prompts-row-alpha-prompt").getByRole("button", { name: "归档" }).click();
  await expect(page.getByRole("status")).toContainText("已归档 Alpha Prompt");
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toContainText("已归档");

  await page.getByRole("button", { name: "仅看已归档" }).click();
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toBeVisible();

  await page.getByTestId("admin-prompts-row-beta-prompt").getByRole("button", { name: "恢复发布" }).click();
  await expect(page.getByRole("status")).toContainText("已恢复发布 Beta Prompt");
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toHaveCount(0);
});

test("后台提示词管理列表在状态筛选下归档和恢复后会重新收敛结果", async ({ page }) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts");

  await page.getByRole("button", { name: "仅看已发布" }).click();
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toHaveCount(0);

  await page.getByTestId("admin-prompts-row-alpha-prompt").getByRole("button", { name: "归档" }).click();
  await expect(page.getByRole("status")).toContainText("已归档 Alpha Prompt");
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toHaveCount(0);
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toBeVisible();

  await page.getByRole("button", { name: "仅看已归档" }).click();
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toBeVisible();

  await page.getByTestId("admin-prompts-row-beta-prompt").getByRole("button", { name: "恢复发布" }).click();
  await expect(page.getByRole("status")).toContainText("已恢复发布 Beta Prompt");
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toHaveCount(0);
});

test("后台提示词管理列表在状态操作后切换筛选时不会被旧请求回填", async ({ page }) => {
  await addAdminCookie(page);

  const categories: ManagedCategory[] = [
    {
      slug: "programming",
      name: "编程",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 2,
    },
    {
      slug: "design",
      name: "设计",
      isSystem: false,
      isSelectable: true,
      isCollapsedByDefault: false,
      promptCount: 1,
    },
  ];

  const promptStore = new Map<string, ManagedPrompt>([
    [
      "alpha-prompt",
      createPromptRecord({
        slug: "alpha-prompt",
        title: "Alpha Prompt",
        summary: "用于验证旧请求回填竞态。",
        status: "published",
        categorySlugs: ["programming"],
        categories: [{ slug: "programming", name: "编程" }],
      }),
    ],
    [
      "beta-prompt",
      createPromptRecord({
        slug: "beta-prompt",
        title: "Beta Prompt",
        summary: "用于验证已归档筛选结果。",
        status: "archived",
        categorySlugs: ["design"],
        categories: [{ slug: "design", name: "设计" }],
      }),
    ],
    [
      "gamma-prompt",
      createPromptRecord({
        slug: "gamma-prompt",
        title: "Gamma Prompt",
        summary: "只应出现在全部状态里。",
        status: "published",
        categorySlugs: ["programming"],
        categories: [{ slug: "programming", name: "编程" }],
      }),
    ],
  ]);

  let archiveTriggered = false;
  let releaseStaleAllResponse;
  const staleAllResponseReleased = new Promise((resolve) => {
    releaseStaleAllResponse = resolve;
  });

  await page.route("**/api/admin/categories", async (route) => {
    await fulfillJson(route, { categories });
  });

  await page.route("**/api/admin/prompts?**", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status") ?? "";

    if (archiveTriggered && status === "") {
      await staleAllResponseReleased;
    }

    const prompts = [...promptStore.values()].filter((item) =>
      status ? item.status === status : true,
    );
    await fulfillJson(route, { prompts });
  });

  await page.route("**/api/admin/prompts/alpha-prompt/archive", async (route) => {
    const prompt = promptStore.get("alpha-prompt");
    if (!prompt) {
      await fulfillJson(route, { error: "prompt not found" }, 404);
      return;
    }
    archiveTriggered = true;
    const updated = { ...prompt, status: "archived" as const };
    promptStore.set(updated.slug, updated);
    await fulfillJson(route, { prompt: updated });
  });

  await page.goto("/admin/prompts");
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toBeVisible();

  await page.getByTestId("admin-prompts-row-alpha-prompt").getByRole("button", { name: "归档" }).click();
  await page.getByRole("button", { name: "仅看已归档" }).click();

  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toHaveCount(0);

  releaseStaleAllResponse?.();

  await expect(page.getByRole("button", { name: "仅看已归档" })).toHaveClass(
    /pm-filter-button-active/,
  );
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toHaveCount(0);
});

test("后台提示词管理列表点击卡片非按钮区域可进入详情页", async ({ page }) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts");

  const row = page.getByTestId("admin-prompts-row-beta-prompt");
  await expect(row).toBeVisible();

  await row.click({ position: { x: 120, y: 80 } });

  await expect(page).toHaveURL(/\/admin\/prompts\/beta-prompt$/);
  await expect(page.getByRole("heading", { level: 1, name: "管理提示词" })).toBeVisible();
  await expect(page.getByText("Beta Prompt")).toBeVisible();
});

test("后台提示词管理列表支持多选并显示浮动操作条", async ({ page }) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts");

  const actionBar = page.getByTestId("admin-prompts-bulk-action-bar");
  await expect(actionBar).toHaveCount(0);

  await page.getByLabel("选择提示词 Alpha Prompt").check();
  await expect(actionBar).toBeVisible();
  await expect(actionBar).toContainText("已选 1 项");
  await expect(actionBar.getByRole("button", { name: "批量增加分类" })).toBeVisible();
  await expect(actionBar.getByRole("button", { name: "批量删除分类" })).toBeVisible();
  await expect(actionBar.getByRole("button", { name: "清空选择" })).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/prompts$/);

  await page.getByLabel("选择提示词 Beta Prompt").check();
  await expect(actionBar).toContainText("已选 2 项");
  await expect(page).toHaveURL(/\/admin\/prompts$/);

  await page.getByLabel("分类").selectOption("design");
  await expect(page).toHaveURL(/\/admin\/prompts$/);
  await page.getByLabel("分类").selectOption("");

  await actionBar.getByRole("button", { name: "清空选择" }).click();
  await expect(actionBar).toHaveCount(0);
  await expect(page.getByLabel("选择提示词 Alpha Prompt")).not.toBeChecked();
  await expect(page.getByLabel("选择提示词 Beta Prompt")).not.toBeChecked();
});

test("后台提示词管理列表支持基于当前筛选结果集全选与反选", async ({ page }) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts");
  await page.getByRole("button", { name: "仅看已发布" }).click();

  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toHaveCount(0);

  await page.getByRole("button", { name: "全选" }).click();
  await expect(page.getByLabel("选择提示词 Alpha Prompt")).toBeChecked();
  await expect(page.getByLabel("选择提示词 Gamma Prompt")).toBeChecked();
  await expect(page.getByTestId("admin-prompts-bulk-action-bar")).toContainText("已选 2 项");

  await page.getByRole("button", { name: "反选" }).click();
  await expect(page.getByLabel("选择提示词 Alpha Prompt")).not.toBeChecked();
  await expect(page.getByLabel("选择提示词 Gamma Prompt")).not.toBeChecked();
  await expect(page.getByTestId("admin-prompts-bulk-action-bar")).toHaveCount(0);

  await page.getByLabel("选择提示词 Alpha Prompt").check();
  await page.getByRole("button", { name: "反选" }).click();
  await expect(page.getByLabel("选择提示词 Alpha Prompt")).not.toBeChecked();
  await expect(page.getByLabel("选择提示词 Gamma Prompt")).toBeChecked();
  await expect(page.getByTestId("admin-prompts-bulk-action-bar")).toContainText("已选 1 项");
});

test("后台提示词管理列表在长列表中仍固定显示批量条", async ({
  page,
}) => {
  await addAdminCookie(page);
  await setupLongPromptListRoutes(page);

  await page.goto("/admin/prompts");

  await page
    .getByTestId("admin-prompts-row-long-prompt-01")
    .getByRole("checkbox", { name: "选择提示词 Long Prompt 1" })
    .check();

  const actionBar = page.getByTestId("admin-prompts-bulk-action-bar");
  await expect(actionBar).toHaveCSS("position", "fixed");
  await expect(actionBar).toBeInViewport();
  await expect(actionBar.getByRole("button", { name: "批量增加分类" })).toBeEnabled();
  await expect(actionBar.getByRole("button", { name: "批量删除分类" })).toBeEnabled();

  await page.getByTestId("admin-prompts-row-long-prompt-20").scrollIntoViewIfNeeded();
  await expect(actionBar).toBeInViewport();
  await expect(actionBar).toContainText("已选 1 项");
});

test("后台提示词管理列表支持批量增加和删除分类并局部更新标签", async ({ page }) => {
  await addAdminCookie(page);
  let promptsListRequestCount = 0;
  await setupPromptManagementRoutes(page, {
    onPromptsListRequest(url) {
      if (url.pathname === "/api/admin/prompts") {
        promptsListRequestCount += 1;
      }
    },
  });
  await page.addInitScript(() => {
    window.__pmPageLoadCount = (window.__pmPageLoadCount ?? 0) + 1;
  });

  await page.goto("/admin/prompts");
  await page.getByRole("button", { name: "仅看已发布" }).click();
  await page.getByLabel("关键词").fill("prompt");

  const beforeUrl = page.url();
  const beforeLoadCount = await page.evaluate(() => window.__pmPageLoadCount ?? 0);
  await expect(page.getByRole("button", { name: "仅看已发布" })).toHaveClass(
    /pm-filter-button-active/,
  );
  await expect(page.getByLabel("分类")).toHaveValue("");
  await expect(page.getByLabel("关键词")).toHaveValue("prompt");

  await page.getByLabel("选择提示词 Alpha Prompt").check();
  await page.getByLabel("选择提示词 Gamma Prompt").check();

  const actionBar = page.getByTestId("admin-prompts-bulk-action-bar");
  await actionBar.getByRole("button", { name: "批量增加分类" }).click();
  await page.getByLabel("内容创作").check();
  await page.getByLabel("设计").check();
  await page.getByRole("button", { name: "确认增加分类" }).click();

  await expect(page.getByRole("status")).toContainText("已批量增加分类");
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toContainText("内容创作");
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toContainText("设计");
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toContainText("内容创作");
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toContainText("设计");
  await expect(page.getByTestId("admin-prompts-bulk-action-bar")).toHaveCount(0);

  await page.getByLabel("选择提示词 Alpha Prompt").check();
  await page.getByLabel("选择提示词 Gamma Prompt").check();

  await page.getByTestId("admin-prompts-bulk-action-bar").getByRole("button", { name: "批量删除分类" }).click();
  await page.getByLabel("内容创作").check();
  await page.getByRole("button", { name: "确认删除分类" }).click();

  await expect(page.getByRole("status")).toContainText("已批量删除分类");
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).not.toContainText("内容创作");
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).not.toContainText("内容创作");
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toContainText("设计");
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toContainText("设计");

  await expect(page).toHaveURL(beforeUrl);
  await expect(page.getByRole("button", { name: "仅看已发布" })).toHaveClass(
    /pm-filter-button-active/,
  );
  await expect(page.getByLabel("分类")).toHaveValue("");
  await expect(page.getByLabel("关键词")).toHaveValue("prompt");
  const afterLoadCount = await page.evaluate(() => window.__pmPageLoadCount ?? 0);
  expect(afterLoadCount).toBe(beforeLoadCount);
  expect(promptsListRequestCount).toBe(3);
});

test("后台提示词管理列表在分类筛选下批量分类后会收敛结果", async ({ page }) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts");
  await page.getByLabel("分类").selectOption("programming");

  const alphaRow = page.getByTestId("admin-prompts-row-alpha-prompt");
  const gammaRow = page.getByTestId("admin-prompts-row-gamma-prompt");
  const betaRow = page.getByTestId("admin-prompts-row-beta-prompt");
  await expect(alphaRow).toBeVisible();
  await expect(gammaRow).toHaveCount(0);
  await expect(betaRow).toHaveCount(0);

  await page.getByLabel("选择提示词 Alpha Prompt").check();
  await page.getByTestId("admin-prompts-bulk-action-bar").getByRole("button", { name: "批量删除分类" }).click();
  await page.getByLabel("编程").check();
  await page.getByRole("button", { name: "确认删除分类" }).click();

  await expect(page.getByRole("status")).toContainText("已批量删除分类");
  await expect(alphaRow).toHaveCount(0);
  await expect(gammaRow).toHaveCount(0);
  await expect(betaRow).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "当前筛选下没有提示词" })).toBeVisible();
  await expect(page.getByLabel("分类")).toHaveValue("programming");
  await expect(page).toHaveURL(/\/admin\/prompts$/);
});

test("后台提示词管理列表在批量分类请求未返回时切换筛选不会被旧响应污染", async ({ page }) => {
  await addAdminCookie(page);

  let releaseBatchCategoriesResponse: (() => void) | undefined;
  const batchCategoriesResponseReleased = new Promise<void>((resolve) => {
    releaseBatchCategoriesResponse = resolve;
  });

  await setupPromptManagementRoutes(page, {
    waitForBatchCategoriesResponse: batchCategoriesResponseReleased,
  });

  await page.goto("/admin/prompts");
  await page.getByRole("button", { name: "仅看已发布" }).click();
  await page.getByLabel("选择提示词 Alpha Prompt").check();
  await page.getByTestId("admin-prompts-bulk-action-bar").getByRole("button", { name: "批量增加分类" }).click();
  await page.getByLabel("设计").check();
  await page.getByRole("button", { name: "确认增加分类" }).click();

  await expect(page.getByRole("status")).toContainText("正在批量增加分类");
  await page.getByRole("button", { name: "仅看已归档" }).click();
  await expect(page.getByRole("button", { name: "仅看已归档" })).toHaveClass(
    /pm-filter-button-active/,
  );
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toHaveCount(0);
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toHaveCount(0);

  releaseBatchCategoriesResponse?.();

  await expect(page.getByRole("button", { name: "仅看已归档" })).toHaveClass(
    /pm-filter-button-active/,
  );
  await expect(page.getByTestId("admin-prompts-row-beta-prompt")).toBeVisible();
  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toHaveCount(0);
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toHaveCount(0);
});

test("后台提示词管理列表支持二段式批量删除提示词并收敛当前列表", async ({ page }) => {
  await addAdminCookie(page);
  const batchDeleteRequests: Array<{ dryRun?: boolean; confirm?: boolean }> = [];
  const promptsListRequests: Array<{ status: string; category: string; keyword: string }> = [];
  await setupPromptManagementRoutes(page, {
    onPromptsListRequest(url) {
      promptsListRequests.push({
        status: url.searchParams.get("status") ?? "",
        category: url.searchParams.get("category") ?? "",
        keyword: url.searchParams.get("keyword") ?? "",
      });
    },
    onBatchDeleteRequest(payload) {
      batchDeleteRequests.push({
        dryRun: payload.dryRun === true,
        confirm: payload.confirm === true,
      });
    },
  });
  await page.addInitScript(() => {
    window.__pmPageLoadCount = (window.__pmPageLoadCount ?? 0) + 1;
  });

  await page.goto("/admin/prompts");
  await page.getByRole("button", { name: "仅看已发布" }).click();
  await page.getByLabel("关键词").fill("prompt");
  const beforeUrl = page.url();
  const beforeLoadCount = await page.evaluate(() => window.__pmPageLoadCount ?? 0);

  await page.getByLabel("选择提示词 Alpha Prompt").check();
  await page.getByLabel("选择提示词 Gamma Prompt").check();
  const actionBar = page.getByTestId("admin-prompts-bulk-action-bar");
  await actionBar.getByRole("button", { name: "批量删除提示词" }).click();

  await expect(page.getByText("删除后不可恢复")).toBeVisible();
  await expect(page.getByText("删除的是提示词本体，不是分类关联")).toBeVisible();
  await expect(page.getByRole("status")).toContainText("批量删除预检查完成");
  expect(batchDeleteRequests).toEqual([{ dryRun: true, confirm: false }]);

  const promptsListRequestCountBeforeDelete = promptsListRequests.length;
  await page.getByRole("button", { name: "确认删除提示词" }).click();
  await expect(page.getByRole("status")).toContainText("已批量删除提示词（2 项）");
  expect(batchDeleteRequests).toEqual([
    { dryRun: true, confirm: false },
    { dryRun: false, confirm: true },
  ]);
  expect(promptsListRequests).toHaveLength(promptsListRequestCountBeforeDelete + 1);
  expect(promptsListRequests.at(-1)).toEqual({
    status: "published",
    category: "",
    keyword: "prompt",
  });

  await expect(page.getByTestId("admin-prompts-row-alpha-prompt")).toHaveCount(0);
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "当前筛选下没有提示词" })).toBeVisible();
  await expect(page.getByTestId("admin-prompts-bulk-action-bar")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "仅看已发布" })).toHaveClass(
    /pm-filter-button-active/,
  );
  await expect(page.getByLabel("关键词")).toHaveValue("prompt");
  await expect(page).toHaveURL(beforeUrl);
  const afterLoadCount = await page.evaluate(() => window.__pmPageLoadCount ?? 0);
  expect(afterLoadCount).toBe(beforeLoadCount);
});

test("后台提示词管理详情页状态标签样式跟随真实状态", async ({ page }) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts/beta-prompt");

  const statusChip = page.locator(".pm-status-chip").filter({ hasText: "已归档" });
  await expect(statusChip).toBeVisible();
  await expect(statusChip).toHaveClass(/archived/);
});

test("后台提示词管理详情支持重新分类并自动移除待分类，且删除走预检查确认", async ({
  page,
}) => {
  await addAdminCookie(page);
  await setupPromptManagementRoutes(page);

  await page.goto("/admin/prompts/gamma-prompt");

  await expect(page.getByRole("heading", { level: 1, name: "管理提示词" })).toBeVisible();
  await expect(page.getByText("Gamma Prompt")).toBeVisible();

  await page.getByLabel("内容创作").check();
  await page.getByRole("button", { name: "保存分类" }).click();

  await expect(page.getByRole("status")).toContainText("已更新 Gamma Prompt 的分类");
  await expect(page.getByTestId("prompt-category-pill-content-creation")).toBeVisible();
  await expect(page.getByTestId("prompt-category-pill-uncategorized")).toHaveCount(0);

  await page.getByRole("button", { name: "删除预检查" }).click();
  await expect(page.getByText("关联版本：2")).toBeVisible();
  await expect(page.getByText("投稿记录：1")).toBeVisible();

  await page.getByRole("button", { name: "确认删除提示词" }).click();
  await expect(page.getByRole("status")).toContainText("已删除提示词 Gamma Prompt");
  await expect(page).toHaveURL(/\/admin\/prompts$/);
  await expect(page.getByTestId("admin-prompts-row-gamma-prompt")).toHaveCount(0);
});
