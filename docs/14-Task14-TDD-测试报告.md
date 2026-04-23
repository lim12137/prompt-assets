# Task 14 TDD 测试报告

## 范围

- 补齐并规范化审计日志最小闭环。
- 覆盖投稿、审核通过、审核拒绝、点赞动作产生日志。
- 在 fixture 数据源下验证真实 PG 不可达时的 API 合同层与写日志逻辑。
- 未实现阶段 D 内容。

## RED

命令：

```bash
pnpm exec node --test --experimental-strip-types tests/unit/domain/audit.test.ts tests/integration/api/audit-log.test.ts
```

结果摘要：

- 失败，`packages/domain/src/audit.ts` 不存在。
- 失败，`prompt-repository.ts` 未导出 `__getAuditLogFixtureStateForTests`。
- 失败原因符合预期：审计事件构造器与 fixture 审计日志读取/写入能力缺失。

## GREEN

命令：

```bash
pnpm exec node --test --experimental-strip-types tests/unit/domain/audit.test.ts tests/integration/api/audit-log.test.ts
```

结果摘要：

- 5 个测试全部通过。
- 覆盖 `buildAuditLogEntry` 最小字段规范化。
- 覆盖投稿、审核通过、审核拒绝、点赞动作写入审计日志。

## 回归

命令：

```bash
pnpm exec node --test --experimental-strip-types tests/integration/api/prompt-submission.test.ts tests/integration/api/admin-submission-review.test.ts tests/integration/api/prompt-like.test.ts tests/integration/api/audit-log.test.ts tests/unit/domain/audit.test.ts
```

结果摘要：

- 15 个测试全部通过。
- 既有投稿、审核、点赞 API 行为未回归。
- Node 输出既有 `ExperimentalWarning` 与 ESM `MODULE_TYPELESS_PACKAGE_JSON` warning，不影响测试结果。

## 补充检查

命令：

```bash
pnpm build:web
```

结果摘要：

- 未通过。
- 首次失败于 Next 15 动态 route 类型约束：`app/api/prompts/[slug]/like/route.ts` 的 `params` 类型为 `RouteParams | Promise<RouteParams>`，生成类型要求 `Promise<any>`。
- 尝试确认同类路由后未继续修改，因为该问题属于项目级 Next 类型收口，不属于 Task 14 审计闭环。
- 后续 build 还暴露 `.ts` 扩展导入缺少 `allowImportingTsExtensions` 配置的问题，同样未在 Task 14 内扩大处理。

## 判定

- Task 14 完成判定：满足。
- 阻塞项：无 Task 14 功能阻塞；`pnpm build:web` 存在既有项目级类型/配置阻塞，需单独任务处理。
