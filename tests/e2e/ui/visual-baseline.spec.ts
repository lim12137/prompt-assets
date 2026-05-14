import { expect, test } from "@playwright/test";

test("task15 baseline: 首页具备深色背景/卡片边框/主标题/主按钮样式", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(248, 249, 251)",
  );

  const homeTitle = page.getByRole("heading", { level: 1, name: "公司提示词库" });
  await expect(homeTitle).toHaveCSS("color", "rgb(17, 24, 39)");
  await expect(homeTitle).toHaveCSS("letter-spacing", "0.6px");

  const firstCard = page.getByTestId("prompt-card").first();
  await expect(firstCard).toHaveCSS("border-top-style", "solid");
  await expect(firstCard).toHaveCSS("border-top-width", "1px");
  await expect(firstCard).toHaveCSS("border-top-color", "rgb(229, 231, 235)");

  const primaryEntry = page.getByRole("link", { name: "创建" });
  await expect(primaryEntry).toHaveCSS("background-color", "rgb(196, 30, 58)");
  await expect(primaryEntry).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(primaryEntry).toHaveCSS("border-radius", "8px");
});

test("task15 baseline: 详情页具备深色背景/内容卡片边框/主标题/关键交互样式", async ({
  page,
}) => {
  const response = await page.goto("/prompts/js-code-reviewer");
  expect(response?.status()).toBe(200);

  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(248, 249, 251)",
  );

  const detailTitle = page.locator("h1.pm-page-title");
  await expect(detailTitle).toHaveCSS("color", "rgb(17, 24, 39)");

  const currentVersionPanel = page.locator("section[aria-label='官方推荐']");
  await expect(currentVersionPanel).toHaveCSS("border-top-style", "solid");
  await expect(currentVersionPanel).toHaveCSS("border-top-width", "1px");
  await expect(currentVersionPanel).toHaveCSS("border-top-color", "rgb(196, 30, 58)");

  const copyButton = page.getByRole("button", { name: "复制此卡内容" }).first();
  await expect(copyButton).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(copyButton).toHaveCSS("color", "rgb(31, 41, 55)");
  await expect(copyButton).toHaveCSS("border-radius", "8px");
});
