# 测试记录：Next dev 启动健康检查与 local-debug 自愈（2026-05-02）

## 范围

- 修复 `run-next` 只看端口监听、不验证 `/api/health` 可响应的问题。
- 修复 `local-debug` Web 启动后不做健康检查的问题，并在健康超时时自动停止当前 Web 子进程、回收项目 Web 监听进程、重试启动。

## RED

```powershell
node --test tests/unit/scripts/local-debug-web-health.test.mjs tests/unit/scripts/run-next-health-check.test.mjs
```

结果摘要：

- 失败，3 个用例失败。
- 失败原因：
  - `scripts/local-debug.mjs` 尚未导出 `startPersistentWebWithHealth`。
  - `apps/web/scripts/run-next.mjs` 尚未导出 `buildStartupHealthTarget` / `runNextCli`。

## GREEN

```powershell
node --test tests/unit/scripts/local-debug-web-health.test.mjs tests/unit/scripts/run-next-health-check.test.mjs
```

结果摘要：

- 3/3 passed，0 failed。
- 覆盖：
  - `local-debug` 在 Web 端口已监听但 health 超时时，停止旧 Web、回收端口并重启。
  - `run-next` 根据 `--hostname` / `--port` 构造 `/api/health` 启动健康检查目标。
  - `run-next` 在启动健康检查超时时向 Next 子进程发送 `SIGTERM`，以非零状态结束。

## 回归测试

```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs tests/unit/scripts/local-debug.test.mjs tests/unit/scripts/local-debug-web-health.test.mjs tests/unit/scripts/run-next-health-check.test.mjs
```

结果摘要：

- 31 passed，0 failed，1 skipped。
- 跳过项：`local-debug web exits non-zero when web port is already occupied`。
- 跳过原因：当前本机 `3010` 已被外部进程占用，测试按既有保护逻辑跳过。

## 结论

- 启动成功不再只依赖端口监听。
- `run-next` 对 `dev` / `start` 增加启动后 `/api/health` 轮询，超时会终止 Next 子进程。
- `local-debug` 对 Web 启动增加健康检查和一次自动自愈重启，仍保留未知进程拒绝停止策略。
