import { expect, test } from "@playwright/test";

test("真实 DB: 管理页读取 pending 列表并完成一次 approve", async ({
  page,
}) => {
  await page.goto("/admin");

  const firstRow = page.getByTestId("submission-row-1");
  const secondRow = page.getByTestId("submission-row-2");

  await expect(firstRow).toContainText("JavaScript 代码审查助手");
  await expect(secondRow).toContainText("落地页文案框架");

  await firstRow.getByRole("button", { name: "通过" }).click();
  await expect(page.getByRole("status")).toContainText(
    "已通过 JavaScript 代码审查助手",
  );
  await expect(firstRow).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("submission-row-1")).toHaveCount(0);
  await expect(page.getByTestId("submission-row-2")).toContainText(
    "落地页文案框架",
  );
});
