import { expect, test } from "@playwright/test";

test("home page ai tools: 左侧 AI 工具小卡片区应具备基础可用性与语义", async ({ page }) => {
  await page.goto("/");

  const aiToolsHeading = page.getByRole("heading", { name: "AI工具" });
  await expect(aiToolsHeading).toBeVisible();

  const aiToolsSection = aiToolsHeading.locator(
    "xpath=ancestor::*[self::aside or self::section or self::div][1]",
  );

  const ceicChatLink = aiToolsSection.getByRole("link", { name: "CEIC Chat" });
  const chatgptLink = aiToolsSection.getByRole("link", { name: "ChatGPT" });
  const claudeLink = aiToolsSection.getByRole("link", { name: "Claude" });

  await expect(ceicChatLink).toBeVisible();
  await expect(chatgptLink).toBeVisible();
  await expect(claudeLink).toBeVisible();

  for (const toolLink of [ceicChatLink, chatgptLink, claudeLink]) {
    await expect(toolLink).toHaveAttribute("href", /^https?:\/\//);
    await expect(toolLink).toHaveAttribute("target", "_blank");
    await expect(toolLink).toHaveAttribute("rel", /noopener/);
    await expect(toolLink).toHaveAttribute("rel", /noreferrer/);
  }

  await expect(aiToolsSection.getByRole("link", { name: /GUI管理|GUI 管理|管理入口/ })).toHaveCount(0);
  await expect(aiToolsSection.getByRole("button", { name: /GUI管理|GUI 管理|管理入口/ })).toHaveCount(0);
});

