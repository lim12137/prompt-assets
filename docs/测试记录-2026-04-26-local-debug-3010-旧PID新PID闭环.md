# 测试记录：local-debug 3010 端口自动回收与旧PID→新PID闭环（2026-04-26）

## 1. 目标

- 修正 `local-debug` 的 3010 端口回收策略：
  - 只要占用 3010 的进程可识别为本仓库 Web/Next 进程（含 `next/dist/server/lib/start-server.js`），自动结束并继续启动。
  - 未知进程默认拒绝误杀。

## 2. TDD 过程

### 2.1 先补失败测试

新增/补充测试：

- `tests/unit/scripts/local-debug-port-ownership.test.mjs`
  - `isProjectWebProcess returns true for workspace next dev command without explicit --port`
  - `isProjectWebProcess returns true for workspace next start-server process`
- `tests/unit/scripts/local-debug-reclaim-flow.test.mjs`
  - `reclaimWebPortIfNeeded kills repository next listener without explicit --port`
  - `reclaimWebPortIfNeeded kills repository next start-server listener`

先红灯验证命令：

```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs
```

结果摘要：新增的 `start-server` 识别用例先失败，符合 TDD “先失败”。

### 2.2 实现最小修复后转绿

修复点：`scripts/local-debug.mjs` 中 `isProjectWebProcess` 增加仓库内 `node_modules/.../next/dist/server/lib/start-server.js` 识别规则。

转绿验证命令：

```powershell
node --test tests/unit/scripts/local-debug-port-ownership.test.mjs tests/unit/scripts/local-debug-reclaim-flow.test.mjs tests/unit/scripts/local-debug-safe-stop-policy.test.mjs tests/unit/scripts/local-debug.test.mjs
```

结果摘要：`24 tests: 23 pass / 0 fail / 1 skip`（skip 为既有端口占用场景跳过用例）。

## 3. 真机闭环验证（旧 PID -> 新 PID）

前置：先清理 3010 监听。

```powershell
node ./scripts/local-debug.mjs stop-web
```

### 3.1 启动旧进程占住 3010

命令：

```powershell
cmd /d /s /c "pnpm dev:web"
```

旧 PID（3010 监听）：`24592`

### 3.2 执行 local-debug.bat web 触发自动回收并重启

命令：

```powershell
cmd /d /s /c "local-debug.bat web"
```

### 3.3 验证切换与可用性

- 新 PID（3010 监听）：`19124`
- 旧 PID `24592` 已退出：是
- 地址：`http://127.0.0.1:3010`
- HTTP 状态：`200`

结论：已完成“本项目旧 Web 占用 3010 时，自动回收旧 PID 并成功拉起新 PID”的真机闭环。
