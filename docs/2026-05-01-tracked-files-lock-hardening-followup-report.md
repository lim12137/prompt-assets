# 2026-05-01 tracked-files 锁语义与 owner 校验补强报告

## 范围

本轮只处理审核追加的 3 个点：

1. 活锁不应仅因超时被误判 stale
2. cleanup 需要 owner 校验，避免 runner finally 误删别人的活锁
3. 相关 hardening 报告里的测试数量与当前代码保持一致

涉及文件：

- `apps/web/scripts/tracked-files-guard.mjs`
- `scripts/run-admin-prompts-management-real-db-e2e.mjs`
- `tests/unit/scripts/tracked-files-guard.test.mjs`
- `tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs`
- `docs/2026-05-01-run-next-tracked-files-cleanup-fix-report.md`
- `docs/2026-05-01-admin-prompts-real-db-e2e-hardening-report.md`

## TDD 记录

先补两条红灯：

- 活锁即使超时也不能被 `cleanupTrackedFilesFromLock()` 判 stale
- owner 不匹配时不能删除别人的活锁

首跑结果：

- `7 tests` 中 `3 failed`
- 失败点分别对应：
  - runner 未透传 `TRACKED_FILES_OWNER_TOKEN`
  - 活锁被“仅因超时”误清
  - owner 不匹配的活锁被误删

随后补实现并复跑转绿。

## 实现摘要

1. stale 判定调整为：
   - 有 `pid` 时只看进程是否仍存活
   - 仅当 `pid` 缺失/无效时，才退回按时间判断
2. tracked-files lock 新增 `trackedFilesOwnerToken`
3. cleanup 新增 `expectedTrackedFilesOwnerToken` 校验
4. 管理页真实库 E2E runner 显式透传 `TRACKED_FILES_OWNER_TOKEN`
5. runner finally 只清理“owner 匹配且已 stale”的 tracked-files lock

## 测试命令与结果

### 1. tracked-files guard + runner 单测

```powershell
node --test tests/unit/scripts/tracked-files-guard.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

结果摘要：

- `7 passed / 0 failed`

### 2. 验证 tracked files 当前没有漂移

```powershell
git diff --exit-code -- apps/web/next-env.d.ts apps/web/tsconfig.json
```

结果摘要：

- 退出码 `0`

### 3. 验证当前没有遗留 tracked-files lock

```powershell
@'
import { cleanupTrackedFilesFromLock } from './apps/web/scripts/tracked-files-guard.mjs';
console.log(JSON.stringify({ cleaned: cleanupTrackedFilesFromLock('./apps/web/.next-tracked-files.lock') }));
'@ | node
```

结果摘要：

- 输出：`{"cleaned":false}`

## 结论

本轮把审核指出的 2 个中级问题和 1 个低级问题都收口了：

- 活锁不会再仅因超时被误判 stale
- runner finally 不会再无 owner 条件删除别人的活锁
- 文档中的测试数量已更新到当前实现状态

## 剩余风险

1. 其他 real-db runner 还没有统一透传 `TRACKED_FILES_OWNER_TOKEN`，如果也复用同类 tracked-files cleanup，建议后续一起收敛。
2. 这轮仍主要靠单测覆盖锁语义；如果后续再出现复杂停服竞态，最好补一条专门制造 stale lock 的进程级回归测试。
