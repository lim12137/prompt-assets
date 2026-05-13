# Task 3 返工验证报告

- 时间：2026-05-13 16:46:35 +08:00
- 范围：仅验证批量删除风险文案、删除成功后按当前筛选重新拉取列表、mock e2e 与 real-db 断言补齐。

## 测试命令

```bash
npx playwright test tests/e2e/admin/prompts-management.spec.ts tests/e2e/admin/prompts-management-real-db.spec.ts --grep "二段式批量删除提示词并收敛当前列表|真实 DB: 列表页支持二段式批量删除提示词并保持当前筛选"
```

## 结果摘要

- 结果：2 passed
- mock e2e：断言了风险文案 `删除的是提示词本体，不是分类关联` 可见。
- mock e2e：断言确认删除后新增 1 次 `/api/admin/prompts` 请求，且请求参数仍为当前筛选 `status=published`、`keyword=prompt`。
- real-db：断言了同一风险文案可见。
- real-db：通过等待删除后的 `/api/admin/prompts?status=published&keyword=<marker>` 响应，证明成功删除后重新拉取了当前筛选列表。
- 两个用例都验证了 URL 未变化、未整页 reload，且删除结果已收敛到当前列表。
