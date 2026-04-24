# E2E Admin Management Flow 一键命令验证报告

日期：2026-04-24

## 红灯

命令：

`pnpm exec playwright test tests/e2e/admin/management-flow.spec.ts`

结果摘要：

- 第一条用例通过。
- 第二条用例失败：`Expected: 2, Received: 0`。
- 失败原因：直接运行目标 spec 时，没有自动准备真实 Docker DB，也没有自动注入 `DATABASE_URL` 到 Playwright 进程及其 `webServer`。

## 修复

命令入口：

- `pnpm test:e2e:admin:db`
- `pnpm test:e2e:admin:management-flow`

实现摘要：

- 复用现有 `scripts/run-admin-real-db-e2e.mjs`。
- 将默认执行的 spec 改为 `tests/e2e/admin/management-flow.spec.ts`。
- 保留自动 `db:test:prepare`、`DATABASE_URL` 注入、测试完成后 `db:test:down` 清理。

## 绿灯

命令：

`pnpm test:e2e:admin:management-flow`

结果摘要：

- 2 条用例全部通过。
- 自动启动真实 Docker DB、执行迁移和 seed。
- 测试完成后自动清理测试数据库容器。
