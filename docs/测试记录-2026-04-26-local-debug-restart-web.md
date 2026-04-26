# local-debug restart-web 验证报告

## 变更目的

- 修复 `local:web:restart` 仅复用 `web`、未真正重启的问题。
- 让本地调试 Web 启动参数由 `scripts/local-debug.mjs` 统一控制，支持 `LOCAL_WEB_HOST`、`LOCAL_WEB_PORT`。

## 使用方式

```powershell
pnpm local:web
pnpm local:web:restart
$env:LOCAL_WEB_HOST="0.0.0.0"
$env:LOCAL_WEB_PORT="14000"
pnpm local:web
```

说明：

- `pnpm local:web` 会按 `LOCAL_WEB_HOST` / `LOCAL_WEB_PORT` 启动 `@prompt-management/web`。
- `pnpm local:web:restart` 会先停止当前监听目标端口的本地 Web 进程，再按同样配置重新启动。

## 验证命令

### 1. 单元测试

```powershell
node --test tests/unit/scripts/local-debug.test.mjs
```

结果摘要：

- 4/4 通过
- 覆盖点：
  - `resolveLocalDebugConfig` 默认值包含 `webHost`、`webPort`
  - `restart-web` 执行计划为 `stop-web -> web`
  - `buildWebDevArgs(config)` 正确拼装 `pnpm --filter @prompt-management/web dev --hostname <host> --port <port>`

### 2. 脚本级参数验证

```powershell
node -e "import('./scripts/local-debug.mjs').then(({resolveLocalDebugConfig,buildExecutionPlan,buildWebDevArgs})=>{const config=resolveLocalDebugConfig({LOCAL_WEB_HOST:'0.0.0.0',LOCAL_WEB_PORT:'14000'}); console.log(JSON.stringify({plan:buildExecutionPlan('restart-web'),args:buildWebDevArgs(config)}));})"
```

结果摘要：

- 输出计划：`["stop-web","web"]`
- 输出参数：`["--filter","@prompt-management/web","dev","--hostname","0.0.0.0","--port","14000"]`

### 3. stop-web 空场景验证

```powershell
node ./scripts/local-debug.mjs stop-web
```

结果摘要：

- 退出码为 `0`
- 在目标端口没有监听进程时，`stop-web` 可安全跳过，不影响后续 `restart-web`

## 结论

- `local:web:restart` 已具备“停后再起”的本地调试能力。
- Web 启动地址和端口已由 `scripts/local-debug.mjs` 控制，不再依赖硬编码脚本参数。
