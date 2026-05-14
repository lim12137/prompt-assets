import { expect, test } from "@playwright/test";

test("详情页 project-management 卡片内容区域有最大高度并可纵向滚动", async ({ page }) => {
  const response = await page.goto("/prompts/project-management");
  expect(response?.status()).toBe(200);

  const officialCard = page.getByTestId("official-card");
  await expect(officialCard).toBeVisible();

  const codeBlock = officialCard.locator(".pm-code-block").first();
  await expect(codeBlock).toBeVisible();

  const styles = await codeBlock.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      maxHeight: computed.maxHeight,
      overflowY: computed.overflowY,
    };
  });

  expect(styles.maxHeight).not.toBe("none");
  expect(styles.overflowY).toBe("auto");
});
