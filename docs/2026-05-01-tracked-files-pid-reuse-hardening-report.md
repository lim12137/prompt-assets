# 2026-05-01 tracked-files 锁 PID 复用残余风险补强报告

## 范围

本轮只处理 `tracked-files` 锁在 PID 复用场景下可能把死锁误判为活锁的残余风险。

涉及文件：

- `apps/web/scripts/tracked-files-guard.mjs`
- `tests/unit/scripts/tracked-files-guard.test.mjs`

## TDD 记录

先补两条针对性测试：

1. `runWithTrackedFilesGuard()` 写锁时需要带上进程身份快照，不能只留 `pid`
2. `cleanupTrackedFilesFromLock()` 遇到“`pid` 仍存活，但启动时间与锁内身份不匹配”的锁时，应按 stale 清理并恢复快照

首跑命令：

```powershell
node --test tests/unit/scripts/tracked-files-guard.test.mjs
```

首跑结果：

- `7 tests` 中 `1 failed`
- 失败点：PID 复用场景仍被判定为活锁，没有触发 stale 清理

随后补实现并复跑转绿。

## 实现摘要

1. `tracked-files` 锁新增 `processIdentity`
   - 当前记录 `pid`
   - 能取到时再记录该进程的 `startedAt`
2. stale 判定从“只看 pid 是否存活”改为“两段式”
   - `pid` 不存活：直接 stale
   - `pid` 仍存活但锁内 `processIdentity` 与当前同 PID 进程身份不匹配：也按 stale 处理
3. 当前脚本环境下的进程启动时间读取方式：
   - Windows：`powershell Get-Process`
   - 非 Windows：`ps -o lstart`
4. 如果运行环境拿不到启动时间，则保留原有降级语义，只按 `pid` 存活性判断，不扩大误删面

## 测试命令与结果

### 1. tracked-files guard 单测

```powershell
node --test tests/unit/scripts/tracked-files-guard.test.mjs
```

结果摘要：

- `7 passed / 0 failed`

### 2. tracked-files guard + runner 相关单测

```powershell
node --test tests/unit/scripts/tracked-files-guard.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

结果摘要：

- `8 passed / 0 failed`

### 3. 验证 tracked files 当前没有漂移

```powershell
git diff --exit-code -- apps/web/next-env.d.ts apps/web/tsconfig.json
```

结果摘要：

- 退出码 `0`

## 结论

本轮已把“PID 被系统复用时，遗留锁可能长期被当成活锁保留”的残余风险继续收紧：

- 锁身份不再只靠 `pid`
- 在当前仓库脚本环境下，可额外利用进程启动时间识别 PID 复用
- 原有 owner 校验与活锁保护语义保持不变

## 剩余风险

1. 如果运行环境无法读取进程启动时间，逻辑会降级回 `pid` 存活性判断，这时 PID 复用风险仍是理论残留。
2. 这轮仍然是单测覆盖；如果后续要把这条风险彻底压平，下一步可以补一条专门模拟“旧锁 + 新进程同 pid 身份不一致”的进程级回归测试。
