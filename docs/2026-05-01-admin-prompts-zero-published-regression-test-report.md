# 2026-05-01 后台提示词管理 `0 published` 回归补测报告

## 范围

- 目标：补齐 `0 published` 场景下后台提示词管理 `archive / restore / delete` 的集成回归测试
- 文件：[tests/integration/api/admin-prompts-management.test.ts](D:/1work/提示词管理/tests/integration/api/admin-prompts-management.test.ts)
- 数据源：`prompt_management_test`

## TDD 记录

1. 先新增 3 条集成测试：
   - `archive`：在真实库全部为 `archived` 时，请求目标 prompt 的归档动作，应命中真实库并返回状态冲突
   - `restore`：在真实库全部为 `archived` 时，请求目标 prompt 的恢复动作，应命中真实库并恢复为 `published`
   - `delete`：在真实库全部为 `archived` 时，请求目标 prompt 的 dry-run 与 confirm 删除，应命中真实库并完成级联删除
2. 首次执行新增测试时出现 1 个失败：
   - 失败原因：测试把归档冲突响应的 `error` 字段误写成错误码
   - 处理：修正断言，改为校验 `code = prompt_status_transition_not_allowed`，并保留 `error` 文案断言
3. 未发现需要补生产代码的行为缺陷，本轮仅补测试与报告

## 执行命令

```powershell
node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts --test-name-pattern "0 个已发布|0 published|零已发布"
```

```powershell
node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts tests/integration/api/audit-log.test.ts
```

## 结果摘要

- 定向 `0 published` 相关集成测试：`10 passed / 0 failed`
- 管理接口与审计集成测试全量：`14 passed / 0 failed`
- 本轮新增覆盖：
  - `POST /api/admin/prompts/[slug]/archive`
  - `POST /api/admin/prompts/[slug]/restore`
  - `DELETE /api/admin/prompts/[slug]/delete`

## 结论

- `0 published` 场景下，后台提示词管理 `archive / restore / delete` 已有真实库回归保护
- 本轮未发现新的生产代码问题
