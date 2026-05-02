# 测试记录：Next dev 运行期健康探测与自愈（2026-05-02）

## 背景

- 已有提交 `0f51a8a` 解决了 Next dev 启动期“端口监听但 health 不响应”的假活问题。
- 本次继续覆盖运行期退化：`pnpm local:web:restart` 后服务短暂恢复，随后出现 `3010` 仍监听但 `/api/health`、`/admin/prompts`、详情接口和详情页超时。

## 修改摘要

- 在 `scripts/local-debug.mjs` 的本地 Web 常驻链路中增加运行期 `/api/health` 轮询。
- 运行期 health 超过阈值失败时：
  - 停止当前 Web 子进程；
  - 复用既有 `reclaimWebPortIfNeeded` 安全回收本仓库 Web/Next 监听进程；
  - 重新启动 Web，并再次等待启动期 health 通过。
- 新增可调环境变量：
  - `LOCAL_WEB_RUNTIME_HEALTH_INTERVAL_MS`，默认 `30000`。
  - `LOCAL_WEB_RUNTIME_HEALTH_FAILURE_THRESHOLD`，默认 `1`。

## TDD 记录

### RED

命令：

```powershell
node --test tests/unit/scripts/local-debug-web-health.test.mjs
```

结果摘要：

- 新增用例 `startPersistentWebWithHealth restarts running web when runtime health becomes timeout`。
- 失败原因符合预期：测试等待运行期重启信号，但当前实现没有运行期 health 监控，Node test 报 `Promise resolution is still pending but the event loop has already resolved`。

### GREEN

命令：

```powershell
node --test tests/unit/scripts/local-debug-web-health.test.mjs
```

结果摘要：

- `2/2` 通过。
- 覆盖路径：启动健康通过后，运行期 health 第一次正常、第二次超时，触发 `SIGTERM` 停止旧 Web、回收端口、启动新 Web，并等待新 Web health 通过。

## 回归测试

命令：

```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs tests/unit/scripts/local-debug.test.mjs tests/unit/scripts/local-debug-web-health.test.mjs tests/unit/scripts/run-next-health-check.test.mjs
```

结果摘要：

- `33` 个测试项中 `32` 个通过，`1` 个跳过，`0` 失败。
- 跳过项：`local-debug web exits non-zero when web port is already occupied`。
- 跳过原因：当前本机 `3010` 已被外部进程占用，测试按既有保护逻辑跳过。

## 剩余风险

- 本次用单测验证自愈控制流，未在本轮强行占用/释放真实 `3010` 做长时间运行验收，避免误杀当前机器上已存在的外部监听进程。
- 运行期探测默认每 `30s` 执行一次，单次 health 超时会按既有 `LOCAL_WEB_HEALTH_TIMEOUT_MS` 判定；如果希望更快自愈，可在本地临时调小 `LOCAL_WEB_RUNTIME_HEALTH_INTERVAL_MS` 和 `LOCAL_WEB_HEALTH_TIMEOUT_MS`。
