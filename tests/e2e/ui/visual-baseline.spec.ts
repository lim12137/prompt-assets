import { expect, test } from "@playwright/test";

test("task15 baseline: 首页具备深色背景/卡片边框/主标题/主按钮样式", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(10, 15, 28)",
  );

  const homeTitle = page.getByRole("heading", { level: 1, name: "Prompt Library" });
  await expect(homeTitle).toHaveCSS("color", "rgb(236, 242, 255)");
  await expect(homeTitle).toHaveCSS("letter-spacing", "0.6px");

  const firstCard = page.getByTestId("prompt-card").first();
  await expect(firstCard).toHaveCSS("border-top-style", "solid");
  await expect(firstCard).toHaveCSS("border-top-width", "1px");
  await expect(firstCard).toHaveCSS("border-top-color", "rgb(49, 67, 98)");

  const primaryButton = page.getByRole("button", { name: "创建" });
  await expect(primaryButton).toHaveCSS("background-color", "rgb(61, 123, 255)");
  await expect(primaryButton).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(primaryButton).toHaveCSS("border-radius", "8px");
});

test("task15 baseline: 详情页具备深色背景/内容卡片边框/主标题/关键交互样式", async ({
  page,
}) => {
  const response = await page.goto("/prompts/js-code-reviewer");
  expect(response?.status()).toBe(200);

  await expect(page.locator("body")).toHaveCSS(
    "background-color",
    "rgb(10, 15, 28)",
  );

  const detailTitle = page.getByRole("heading", { level: 1, name: "JavaScript 代码审查助手" });
  await expect(detailTitle).toHaveCSS("color", "rgb(236, 242, 255)");

  const currentVersionPanel = page.locator("section[aria-label='当前版本']");
  await expect(currentVersionPanel).toHaveCSS("border-top-style", "solid");
  await expect(currentVersionPanel).toHaveCSS("border-top-width", "1px");
  await expect(currentVersionPanel).toHaveCSS("border-top-color", "rgb(49, 67, 98)");

  const copyButton = page.getByRole("button", { name: "复制当前版本" });
  await expect(copyButton).toHaveCSS("background-color", "rgb(61, 123, 255)");
  await expect(copyButton).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(copyButton).toHaveCSS("border-radius", "8px");
});
