# 2026-05-01 提示词管理 E2E QA 修复报告

## 目标

按 `/qa` 思路处理提示词管理端到端检测现存问题，重点覆盖：

1. 真实库管理页 E2E 的 `LOGIN_TOKEN_SECRET` 读取与失败语义
2. Playwright / Next 运行后 `apps/web/next-env.d.ts` 被写脏的问题
3. runner / guard 的收尾恢复可靠性

## 本次修改

- 新增 [scripts/workspace-env.mjs](D:/1work/提示词管理/scripts/workspace-env.mjs)
  - 统一读取最近 `.env`
  - 支持带引号、带 `=` 的 secret
- 更新 [tests/e2e/admin/prompts-management-real-db.spec.ts](D:/1work/提示词管理/tests/e2e/admin/prompts-management-real-db.spec.ts)
  - 改为强制读取 `LOGIN_TOKEN_SECRET`
  - 删除 `skip` 假成功路径
- 更新 [apps/web/scripts/tracked-files-guard.mjs](D:/1work/提示词管理/apps/web/scripts/tracked-files-guard.mjs)
  - 增加执行结束后的 `postRunSettleMs`
  - 覆盖“run 已结束但还有晚到改写”的恢复场景
- 更新 [tests/unit/scripts/tracked-files-guard.test.mjs](D:/1work/提示词管理/tests/unit/scripts/tracked-files-guard.test.mjs)
  - 补“延迟改写后仍能恢复”的回归测试
- 新增 [apps/web/scripts/run-playwright-webserver.mjs](D:/1work/提示词管理/apps/web/scripts/run-playwright-webserver.mjs)
  - 统一封装 Playwright `webServer`
  - 启动前执行 `prebuild-clean`
  - 停服后重复恢复 tracked files，并清理对应 dist 目录
- 新增 [tests/e2e/global-setup.ts](D:/1work/提示词管理/tests/e2e/global-setup.ts)
- 新增 [tests/e2e/global-teardown.ts](D:/1work/提示词管理/tests/e2e/global-teardown.ts)
  - 在 Playwright 主进程级别快照 / 恢复 `apps/web/next-env.d.ts` 与 `apps/web/tsconfig.json`
  - 清理 `.tmp/playwright-tracked-files-snapshot.json`
- 更新 [playwright.config.ts](D:/1work/提示词管理/playwright.config.ts)
  - `webServer` 改走统一 wrapper
  - 接入 `globalSetup / globalTeardown`
- 更新 [tests/unit/scripts/playwright-webserver-command.test.ts](D:/1work/提示词管理/tests/unit/scripts/playwright-webserver-command.test.ts)
  - 校验新的 wrapper 与 Playwright 全局收尾配置

## TDD 记录

### Red

先补回归测试：

```powershell
node --test tests/unit/scripts/tracked-files-guard.test.mjs
```

首次失败点：

- `runWithTrackedFilesGuard` 对 “run 结束后晚到的异步改写” 没有兜底

### Green

补实现后重跑通过，之后又继续用真实 Playwright E2E 验证了 `next-env.d.ts` 污染问题，最终把恢复提到 `globalTeardown` 层解决。

## 本轮执行命令

```powershell
node --test tests/unit/scripts/tracked-files-guard.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs tests/unit/scripts/workspace-env.test.mjs
```

```powershell
node --test --experimental-strip-types tests/unit/scripts/playwright-webserver-command.test.ts
```

```powershell
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --reporter=line
```

```powershell
pnpm run test:e2e:admin:prompts:db
```

```powershell
git diff --exit-code -- apps/web/next-env.d.ts apps/web/tsconfig.json
```

```powershell
Test-Path apps/web/.next-tracked-files.lock; Test-Path .tmp/playwright-tracked-files-snapshot.json
```

## 结果摘要

- `tracked-files-guard / admin-prompts runner / workspace-env` 单测：`12 passed / 0 failed`
- Playwright webServer 配置单测：`1 passed / 0 failed`
- 管理页前端 E2E：`5 passed / 0 failed`
- 真实库管理页 E2E：`1 passed / 0 failed`
- 跑后校验：
  - `apps/web/next-env.d.ts` 无脏改动
  - `apps/web/tsconfig.json` 无脏改动
  - `apps/web/.next-tracked-files.lock` 不残留
  - `.tmp/playwright-tracked-files-snapshot.json` 不残留

## 结论

这轮 `/qa` 处理后，提示词管理相关 E2E 的两个关键问题都已收口：

1. 真实库管理页 E2E 不再因为缺失 secret 而 `skip` 假成功
2. 直接跑 Playwright 管理页用例后，不再把 `apps/web/next-env.d.ts` 与 `apps/web/tsconfig.json` 留成脏状态

## 剩余风险

- 当前验证重点是提示词管理相关链路，仓库里其他若干 E2E 若后续也需要同样的“跑后清理”约束，建议统一复用当前 `globalSetup / globalTeardown` 方案继续补覆盖。
- Node 仍会输出 `Type Stripping` 与 `MODULE_TYPELESS_PACKAGE_JSON` 警告，但不影响本轮结论。
