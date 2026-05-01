# 2026-05-01 run-next / Next dev 停服后 tracked files 清理修复报告

## 范围

本轮只处理 `run-next / Next dev` 停服后的 tracked files 清理问题，未改业务功能代码。

涉及文件：

- `apps/web/scripts/run-next.mjs`
- `apps/web/scripts/tracked-files-guard.mjs`
- `scripts/run-admin-prompts-management-real-db-e2e.mjs`
- `tests/unit/scripts/tracked-files-guard.test.mjs`
- `tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs`

## 修复点

1. `run-next` 通过 `tracked-files-guard` 包裹执行 `next` CLI，保留对子进程信号转发。
2. `tracked-files-guard` 锁文件新增快照内容，异常退出后可用遗留锁恢复 `next-env.d.ts` 与 `tsconfig.json`。
3. `tracked-files-guard` 在启动前会尝试清理 stale lock，并在进程 `exit` 时做同步兜底清理。
4. 真实库管理页 E2E runner 在 Playwright 返回后，主动清理 `apps/web/.next-tracked-files.lock` 遗留。

## TDD 记录

先补红灯：

- `cleanupTrackedFilesFromLock` 应能根据 stale lock 快照恢复 tracked files
- runner 收尾应主动清理 tracked files lock

随后补实现，再增加一条回归：

- `runWithTrackedFilesGuard` 运行中必须把快照写入 lock，确保异常停服后可恢复

## 测试命令与结果

### 1. unit：tracked-files guard + runner

```powershell
node --test tests/unit/scripts/tracked-files-guard.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

结果摘要：

- `5 passed / 0 failed`

### 2. 验证 tracked files 已恢复为受控内容

```powershell
git diff --exit-code -- apps/web/next-env.d.ts apps/web/tsconfig.json
```

结果摘要：

- 退出码 `0`
- 当前工作区不再保留这两个 tracked files 的脏改动

### 3. 验证当前没有遗留 tracked-files lock

```powershell
@'
import { cleanupTrackedFilesFromLock } from './apps/web/scripts/tracked-files-guard.mjs';
console.log(JSON.stringify({ cleaned: cleanupTrackedFilesFromLock('./apps/web/.next-tracked-files.lock') }));
'@ | node
```

结果摘要：

- 输出：`{"cleaned":false}`
- 说明当前没有遗留 lock 需要清理

## 结论

已补上两层兜底：

- `run-next` 侧：启动前清 stale lock，运行时落快照，退出时恢复
- runner 侧：Playwright 返回后再做一次 lock 清理

这样即使 Playwright 停服时 `run-next` 父子进程退出时序不稳定，也能在下一次启动或本次 runner 收尾时把 tracked files 拉回受控状态。

## 残余风险

1. 这次补的是 `apps/web/.next-tracked-files.lock` 恢复链路；如果某次异常场景下 lock 被外部提前删掉、但 `next dev` 仍在更晚时刻改写 tracked files，这条链路拿不到快照，只能靠后续新的 run 重新覆盖。
2. 本轮只对提示词管理真实库 E2E runner 加了主动收尾；其他 real-db runner 若复用同类停服路径，建议后续统一接入同样的 cleanup 调用。
