import { expect, test } from "@playwright/test";

test("prompt detail task11: 点击复制后出现成功反馈", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {},
      },
    });
  });

  const response = await page.goto("/prompts/js-code-reviewer");
  expect(response?.status()).toBe(200);

  await page.getByRole("button", { name: "复制当前版本" }).click();
  await expect(page.getByRole("status")).toContainText("复制成功");
});
