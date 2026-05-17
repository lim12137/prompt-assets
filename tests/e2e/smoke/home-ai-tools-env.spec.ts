import { expect, test } from "@playwright/test";

test("home page ai tools env: env 覆盖后 3 个工具仍可渲染", async ({ page }) => {
  await page.goto("/");

  const aiToolsSection = page.getByTestId("home-ai-tools-section");
  await expect(aiToolsSection).toBeVisible();

  const ceicChatLink = aiToolsSection.getByRole("link", { name: "CEIC Chat" });
  const chatgptLink = aiToolsSection.getByRole("link", { name: "ChatGPT" });
  const claudeProLink = aiToolsSection.getByRole("link", { name: "Claude Pro" });

  await expect(ceicChatLink).toBeVisible();
  await expect(chatgptLink).toBeVisible();
  await expect(claudeProLink).toBeVisible();

  await expect(aiToolsSection.getByTestId("home-ai-tool-card")).toHaveCount(3);
  await expect(claudeProLink).toHaveAttribute("href", "https://claude.ai/pro");
});
