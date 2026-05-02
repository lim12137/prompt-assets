# 测试记录：其他本地 Web 启动入口 health 自愈同步（2026-05-02）

## 目标

把已经在 `local-debug restart-web` 验证有效的本地 Web health 自愈逻辑，同步到仓库里其他本地 Web 启动入口，范围保持收敛，不改业务页面逻辑。

## 启动入口识别结果

本轮只纳入“本地 Web 启动入口 / runner / wrapper”，不含 `build`：

1. 已有外层保护，继续保留：
   - `pnpm local:web`
   - `pnpm local:web:restart`
   - `pnpm local:dev`
   - `local-debug.bat web / restart-web / dev`

2. 之前没有运行期自愈、现在通过 `run-next` 统一继承：
   - 根脚本 `pnpm dev:web`
   - 根脚本 `pnpm start:web`
   - `apps/web/package.json` 中的 `dev`
   - `apps/web/package.json` 中的 `start`
   - `playwright.config.ts` 的 `webServer`
   - `apps/web/scripts/run-playwright-webserver.mjs`
   - 依赖 Playwright `webServer` 的真实库 runner：
     - `scripts/run-admin-real-db-e2e.mjs`
     - `scripts/run-admin-create-import-real-db-e2e.mjs`
     - `scripts/run-admin-category-management-real-db-e2e.mjs`
     - `scripts/run-admin-prompts-management-real-db-e2e.mjs`
     - `scripts/run-detail-real-db-e2e.mjs`

3. 明确不纳入：
   - `build:web`
   - `apps/web package build`

原因：`build` 是一次性构建，不是本地常驻 Web 服务。

## TDD 过程

### RED

先给 `run-next` 补两条失败测试：

1. `buildRuntimeHealthTarget uses forwarded hostname and port for runtime watchdog`
2. `runNextCli restarts next when runtime health check starts timing out`

执行：

```powershell
node --test tests/unit/scripts/run-next-health-check.test.mjs
```

结果摘要：

- `2` 条既有启动期测试通过
- 新增 `buildRuntimeHealthTarget` 断言失败，因为函数不存在
- 新增运行期重启测试挂起，因为 `run-next` 还没有运行期 watchdog

### GREEN

实现点：

1. 在 [apps/web/scripts/run-next.mjs](D:/1work/提示词管理/apps/web/scripts/run-next.mjs) 新增：
   - `buildRuntimeHealthTarget()`
   - `checkHttpHealth()`
   - `monitorRuntimeHealth()`
2. `runNextCli()` 对 `dev/start` 增加运行期 health 监控：
   - 周期探测 `/api/health`
   - 达到失败阈值后向当前 Next 子进程发 `SIGTERM`
   - 自动重新拉起一次
3. 在 [scripts/local-debug.mjs](D:/1work/提示词管理/scripts/local-debug.mjs) 给其子链路注入：
   - `NEXT_STARTUP_HEALTH_CHECK=0`
   - `NEXT_RUNTIME_HEALTH_CHECK=0`

这样 `local-debug` 继续做外层总控，避免和下沉到 `run-next` 的 watchdog 双重抢占。

## 验证命令

### 1. 定向红绿

```powershell
node --test tests/unit/scripts/run-next-health-check.test.mjs
```

结果摘要：

- 绿色后 `4/4` 通过

### 2. 本地 Web / run-next 回归

```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs tests/unit/scripts/local-debug.test.mjs tests/unit/scripts/local-debug-web-health.test.mjs tests/unit/scripts/run-next-health-check.test.mjs
```

结果摘要：

- `35` 项中 `34 passed / 0 failed / 1 skipped`
- 跳过项是既有 `3010` 外部占用保护测试

### 3. 真实库 prompts runner 结构回归

```powershell
node --test tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

结果摘要：

- `1 passed / 0 failed`

### 4. Playwright webServer wrapper 回归

```powershell
node --test --experimental-strip-types tests/unit/scripts/playwright-webserver-command.test.ts
```

结果摘要：

- `1 passed / 0 failed`

## 结果

本轮没有去每个 runner 单独重复造 watchdog，而是把运行期保护统一下沉到 `run-next`：

- 直接跑 `pnpm dev:web` / `pnpm start:web` 的链路已覆盖
- Playwright `webServer` 已覆盖
- 所有依赖该 `webServer` 的真实库 E2E runner 已间接受益
- `local-debug` 保持原先外层自愈逻辑，不与内层 `run-next` 双重竞争

## 修改文件

- [apps/web/scripts/run-next.mjs](D:/1work/提示词管理/apps/web/scripts/run-next.mjs)
- [scripts/local-debug.mjs](D:/1work/提示词管理/scripts/local-debug.mjs)
- [tests/unit/scripts/run-next-health-check.test.mjs](D:/1work/提示词管理/tests/unit/scripts/run-next-health-check.test.mjs)

## 剩余风险

1. `run-next` 当前默认只做一次运行期自动重启；如果需要更激进的常驻保活，可以再把重启次数配置调大。
2. 本轮主要是脚本层单测与 wrapper 回归，没有再为每个真实库 runner 各跑一条长时间现场观察。
3. 工作区里仍有本次任务之外的既有脏改动和未跟踪文件，本轮未触碰。
