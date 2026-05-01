# 2026-05-01 管理页真实库 E2E 健壮性加固报告

## 目标

修复提示词管理真实库 E2E 的 3 个问题：

1. `LOGIN_TOKEN_SECRET` 缺失时不应通过 `skip` 造成假成功
2. 自定义 Next `dist` 不应污染被跟踪文件 `next-env.d.ts` / `tsconfig.json`
3. `.env` 中 `LOGIN_TOKEN_SECRET` 的读取不能再使用 `split("=")[1]`

## 本次修改

### 1. Secret 注入与失败语义

- 新增 [scripts/workspace-env.mjs](D:/1work/提示词管理/scripts/workspace-env.mjs)
  - 统一提供 `.env` 解析与最近工作区 `.env` 读取
  - 支持带引号、带 `=` 的值
- 更新 [scripts/run-admin-prompts-management-real-db-e2e.mjs](D:/1work/提示词管理/scripts/run-admin-prompts-management-real-db-e2e.mjs)
  - 启动前强制读取 `LOGIN_TOKEN_SECRET`
  - 若缺失，直接抛错失败，不再依赖测试用例内部 `skip`
  - 显式透传到 Playwright 子进程
- 更新 [tests/e2e/admin/prompts-management-real-db.spec.ts](D:/1work/提示词管理/tests/e2e/admin/prompts-management-real-db.spec.ts)
  - 删除 `test.skip(!token, ...)`
  - 改为直接从共享 helper 取 required secret

### 2. tracked files 防污染

- 新增 [apps/web/scripts/tracked-files-guard.mjs](D:/1work/提示词管理/apps/web/scripts/tracked-files-guard.mjs)
  - 在启动 Next 前快照 `next-env.d.ts` 与 `tsconfig.json`
  - 结束后自动恢复
  - 使用锁文件串行化恢复过程，降低并发互扰
  - 增加 `SIGTERM / SIGINT` 清理，覆盖 Playwright 主动终止 webServer 的场景
  - stale 判定优先看持锁进程存活状态，避免仅因超时误删仍在运行的 `run-next`
  - 增加 tracked-files owner token，runner finally 只清自己的 stale lock
- 更新 [apps/web/scripts/run-next.mjs](D:/1work/提示词管理/apps/web/scripts/run-next.mjs)
  - 接入 `runWithTrackedFilesGuard`

### 3. 稳定基线恢复

- 将 [apps/web/next-env.d.ts](D:/1work/提示词管理/apps/web/next-env.d.ts) 恢复为稳定基线引用
- 将 [apps/web/tsconfig.json](D:/1work/提示词管理/apps/web/tsconfig.json) 恢复为稳定基线 include 列表

## 新增/更新测试

- [tests/unit/scripts/workspace-env.test.mjs](D:/1work/提示词管理/tests/unit/scripts/workspace-env.test.mjs)
- [tests/unit/scripts/tracked-files-guard.test.mjs](D:/1work/提示词管理/tests/unit/scripts/tracked-files-guard.test.mjs)
- [tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs](D:/1work/提示词管理/tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs)

## TDD 记录

### Red

先新增失败测试后执行：

```powershell
node --test tests/unit/scripts/workspace-env.test.mjs tests/unit/scripts/tracked-files-guard.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

失败点：

- 缺少 `scripts/workspace-env.mjs`
- 缺少 `apps/web/scripts/tracked-files-guard.mjs`
- runner 未透传 `LOGIN_TOKEN_SECRET`

### Green

完成实现后重跑：

```powershell
node --test tests/unit/scripts/workspace-env.test.mjs tests/unit/scripts/tracked-files-guard.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

结果：`7 passed / 0 failed`

## 本轮执行命令

```powershell
node --test tests/unit/scripts/workspace-env.test.mjs tests/unit/scripts/tracked-files-guard.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

```powershell
node --test --experimental-strip-types tests/unit/scripts/playwright-webserver-command.test.ts
```

```powershell
pnpm run test:e2e:admin:prompts:db
```

```powershell
git diff -- apps/web/next-env.d.ts apps/web/tsconfig.json
```

```powershell
Test-Path apps/web/.next-tracked-files.lock
```

## 结果摘要

- `workspace-env / tracked-files-guard / runner` 单测：`7 passed / 0 failed`
- Playwright webServer 命令单测：`1 passed / 0 failed`
- 真实库管理页 E2E：`1 passed / 0 failed`
- E2E 结束后检查：
  - `apps/web/next-env.d.ts` 无新增内容漂移
  - `apps/web/tsconfig.json` 无新增内容漂移
  - `apps/web/.next-tracked-files.lock` 不残留（`False`）

## 结论

本轮 3 个问题均已落地修复：

1. `LOGIN_TOKEN_SECRET` 缺失时会明确失败，不再静默 skip
2. 自定义 `dist` 跑完后不会继续污染 `next-env.d.ts / tsconfig.json`
3. tracked-files 清理不会再因为活锁超时或 owner 不匹配而误删
4. `.env` secret 读取改为基于首个 `=` 分隔，兼容带 `=` 的值

## 仍存风险

- 这次只加固了“提示词管理真实库 E2E”这条链路；仓库里其他若干 E2E 文件仍保留旧的 `readSecretFromDotEnv()` 重复实现，后续最好统一切到共享 helper。
- 当前 Node 运行仍会出现 `MODULE_TYPELESS_PACKAGE_JSON` 与 `Type Stripping` 警告，但不影响这轮测试结论。
