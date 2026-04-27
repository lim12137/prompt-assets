# ENOSPC 恢复与最小 QA 报告（2026-04-27）

## 背景
- 目标：修复本地 `ENOSPC` 导致的本地服务 `500`，恢复 `http://127.0.0.1:3010/` 与 `/api/health`，并执行最小 smoke/qa。
- 工作目录：`D:\1work\提示词管理`

## 清理前状态
- 命令：
```powershell
Get-PSDrive -Name D
```
- 结果摘要：
  - `D_FREE_BEFORE_GB=0.004`（几乎满盘）

## 清理动作（仅可再生缓存/构建产物）
- 先安全停止项目 web 进程：
```powershell
node .\scripts\local-debug.mjs stop-web
```

- 清理命令（存在才删除）：
```powershell
Remove-Item -LiteralPath D:\1work\提示词管理\apps\web\.next-dev -Recurse -Force
Remove-Item -LiteralPath D:\1work\提示词管理\.tmp -Recurse -Force
Remove-Item -LiteralPath D:\.pnpm-store -Recurse -Force
```

- 清理体积摘要：
  - `D:\.pnpm-store` 约 `0.66 GB`（可再生包缓存）
  - `D:\1work\提示词管理\apps\web\.next-dev` 约 `0.02 GB`（Next dev 构建缓存）
  - `D:\1work\提示词管理\.tmp` 约 `0.00 GB`（临时目录）

- 空间变化：
  - `D_FREE_BEFORE_GB=0.004`
  - `D_FREE_AFTER_GB=0.343`
  - `D_FREED_GB=0.339`

## 最小服务链重启
- 数据库状态检查：
```powershell
pnpm local:db:status
```
- 结果：`prompt-assets-local-db` 为 `Up (healthy)`。

- 重启 web（后台）：
```powershell
Start-Process -FilePath node -ArgumentList '.\scripts\local-debug.mjs','web' -WorkingDirectory 'D:\1work\提示词管理' -WindowStyle Hidden
```
- 结果：`3010` 端口恢复监听。

## HTTP 验证
- 验证命令：
```powershell
Invoke-WebRequest http://127.0.0.1:3010/
Invoke-WebRequest http://127.0.0.1:3010/api/health
```
- 结果摘要：
  - `GET /` => `200`
  - `GET /api/health` => `200`，返回 `{"status":"ok"}`

## 最小 smoke/qa
- 执行命令：
```powershell
pnpm test:runtime
```
- 结果摘要：
  - `pass 2`
  - `fail 0`
  - 退出码：`0`

## 当前状态
- 本次恢复后 D 盘可用空间约：`0.32 GB`
- 本地服务已恢复到可访问状态，最小 smoke 已通过。
