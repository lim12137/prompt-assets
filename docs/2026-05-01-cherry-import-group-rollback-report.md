# 2026-05-01 Cherry 导入未知分组回滚验证报告

## 处理目标

- 有边界地撤回最近把 Cherry 非标准 `group` 统一落到 `cherry` 分组的规则改动。
- 保留此前已完成的 Cherry Studio 助手对象数组导入兼容能力。
- 验证恢复后的行为为 `unknown group -> uncategorized`。

## 实际处理方式

- 仅回退 `apps/web/app/api/admin/prompts/import/route.ts` 中针对未知 Cherry `group` 的专用映射与补偿逻辑。
- 将 `tests/integration/api/admin-prompts-import.test.ts` 对应断言恢复为 `uncategorized`。
- 未回退 `apps/web/lib/api/prompt-repository.ts` 中的 `createAdminCategory` fixture 支持，因为该能力已被其他路径复用，超出本次规则回滚边界。

## 测试命令

```bash
node --test --experimental-strip-types tests/integration/api/admin-prompts-import.test.ts
```

## 结果摘要

- 结果：11/11 通过，0 失败，0 跳过。
- 重点确认：
  - Cherry Studio 助手对象数组导入兼容仍然通过。
  - `group=Programming` 仍正常映射到 `programming`。
  - 当 Cherry `id` 为空且 `group` 无法匹配现有分类时，导入成功，落点恢复为 `categorySlug=uncategorized`、`categorySlugs=["uncategorized"]`。

## 结论

- 本次回滚已限制在目标规则范围内。
- Cherry 导入兼容本体保留。
- 未发现与本次回滚直接相关的失败回归。
