# 2026-05-01 Cherry 导入分组回退测试报告

## 变更目标

- 将 Cherry Studio 导入时无法匹配的 `group`，从回退到 `uncategorized` 改为优先进入 `cherry` 分组。
- 当系统尚不存在 `cherry` 分类时，在兼容入口层用最保守方式保证导入不失败。

## 测试命令

```bash
node --test --experimental-strip-types tests/integration/api/admin-prompts-import.test.ts
node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts tests/integration/api/admin-prompts-import.test.ts
```

## 结果摘要

### 1. Cherry 导入主测试

- 命令：`node --test --experimental-strip-types tests/integration/api/admin-prompts-import.test.ts`
- 结果：11/11 通过，0 失败
- 重点确认：
  - Cherry 官方助手对象数组导入不受影响
  - `group` 可匹配已有分类时仍映射到既有分类
  - `group` 无法匹配时，导入结果改为 `categorySlug=cherry`
  - 当测试初始状态中不存在 `cherry` 分类时，导入仍成功

### 2. 相关分类路径回归

- 命令：`node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts tests/integration/api/admin-prompts-import.test.ts`
- 结果：
  - `tests/integration/api/admin-prompts-import.test.ts`：11/11 通过
  - `tests/integration/api/admin-categories.test.ts`：8 个用例因测试库不可达被跳过，0 失败
- 跳过原因：
  - 测试输出显示 `postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test` 不可达

## 结论

- 本次最小改动已满足目标行为。
- 在 fixture 测试环境下，未预置 `cherry` 分类时也能成功导入到 `cherry`。
- 未发现与现有导入路径直接相关的失败回归。
