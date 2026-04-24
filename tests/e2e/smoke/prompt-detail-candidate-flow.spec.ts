import { expect, test } from "@playwright/test";

test("详情页展示官方推荐卡与员工最新候选卡，并支持提交候选与复制", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {},
      },
    });
  });

  await page.goto("/prompts/js-code-reviewer");

  await expect(
    page.getByRole("heading", { level: 2, name: "官方推荐卡" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "员工候选卡" }),
  ).toBeVisible();
  await expect(page.getByTestId("employee-candidate-card")).toHaveCount(1);

  await page
    .getByTestId("official-card")
    .getByRole("button", { name: "复制此卡内容" })
    .click();
  await expect(page.getByRole("status")).toContainText("复制成功");

  await page.getByLabel("候选内容").fill("新增候选内容");
  await page.getByRole("button", { name: "提交候选迭代" }).click();
  await expect(page.getByText("候选提交中")).toBeVisible();
  await expect(page.getByText("提交成功")).toBeVisible();
  await expect(page.getByText("v0001-cand-alice-")).toBeVisible();
});
