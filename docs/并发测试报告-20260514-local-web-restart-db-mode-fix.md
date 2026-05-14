# 并发测试报告：local:web:restart 固定 DB 模式修复（2026-05-14）

## 目标
- 修复 `pnpm local:web:restart` 后提示词回退到初始 fixture 的问题。
- 验证重启后后台可用，并确认运行时走 DB 路径（非 fixture 内存态）。

## 执行命令
```powershell
node --test tests/unit/scripts/local-debug.test.mjs
```

```powershell
# 运行时重启验收（后台启动重启命令 + 健康检查 + API 采样）
powershell -NoProfile -Command "<验收脚本，见本次操作记录>"
```

```powershell
# 关键运行态探针
powershell -NoProfile -Command "Invoke-WebRequest http://127.0.0.1:3010/api/health"
powershell -NoProfile -Command "Invoke-WebRequest http://127.0.0.1:3010/api/prompts"
powershell -NoProfile -Command "Invoke-WebRequest http://127.0.0.1:3010/api/prompts/blog-outline-generator"
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 3010 -State Listen"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"ProcessId=<3010监听PID>\""
```

## 结果摘要
- 单测：`tests/unit/scripts/local-debug.test.mjs` 全部通过（15 个子测试，14 过 + 1 skip）。
- 重启可用性：
  - `/api/health` 返回 `200`，服务可用。
  - `/api/prompts` 返回 `200`，示例结果数量 `16`，首个 slug 为 `academic-researcher`。
- DB 模式证据（非 fixture）：
  - `/api/prompts` 中 `blog-outline-generator` 不存在（`HAS_FIXTURE_SLUG=False`）。
  - `/api/prompts/blog-outline-generator` 返回 `404`（该 slug 在 fixture 固定存在；若走 fixture 应可命中）。
  - 端口 `3010` 监听进程为 Next `start-server.js`，说明重启后后台链路正常承接请求。
- 重启日志：
  - `tmp-local-web-restart-verify-1.out.log` 显示 `pnpm local:web:restart` 启动后 `Ready`，并成功处理 `/api/health`、`/api/prompts` 请求。

## 结论
- 修复后 `local:web:restart` 运行时环境已强制注入 DB 模式变量，且默认 DB 指向项目约束远端库；
- 实测重启后不再回到 fixture 初始内存态，后台可持续提供 DB 数据。
