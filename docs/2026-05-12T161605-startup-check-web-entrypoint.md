# 系统启动检测 + Web 页面入口定位报告（2026-05-12 16:16:05）

## 检查目标

- 验证本地 Web 启动状态是否正常。
- 定位仓库中的 Web 主入口页面，并给出推荐访问 URL。

## 执行命令

```powershell
Get-Date -Format 'yyyy-MM-ddTHH-mm-ss'
```

```powershell
$ErrorActionPreference='Stop'; try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3010/api/health' -TimeoutSec 5; [pscustomobject]@{StatusCode=$r.StatusCode; Body=($r.Content.Trim())} | ConvertTo-Json -Compress } catch { 'ERROR: ' + $_.Exception.Message }
```

```powershell
$ErrorActionPreference='Stop'; try { $r = Invoke-WebRequest -UseBasicParsing 'http://127.0.0.1:3010/' -TimeoutSec 5; [pscustomobject]@{StatusCode=$r.StatusCode; Title=([regex]::Match($r.Content,'<title>(.*?)</title>').Groups[1].Value); Snippet=($r.Content.Substring(0,[Math]::Min(160,$r.Content.Length))) } | ConvertTo-Json -Compress } catch { 'ERROR: ' + $_.Exception.Message }
```

```powershell
Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess,State | Format-Table -AutoSize | Out-String -Width 200
```

```powershell
Get-Content -Raw 'apps/web/app/page.jsx'
```

```powershell
Get-Content -Raw 'apps/web/package.json'
```

## 结果摘要

- 当前本地 `127.0.0.1:3010` 没有监听进程。
- 访问 `http://127.0.0.1:3010/api/health` 返回连接被拒绝。
- 访问 `http://127.0.0.1:3010/` 返回连接被拒绝。
- 路由代码确认 Web 主入口是根路由 `/`，对应 `apps/web/app/page.jsx`。
- 运行脚本确认本地标准 Web 基址为 `http://127.0.0.1:3010`。

## 结论

- 本次系统启动检测结果为失败，原因是本地 Web 服务未启动或未在 `3010` 端口提供监听。
- Web 页面入口已定位为根页面 `/`；在服务正常启动后，应优先访问该路径进行验证。

## 推荐访问页面 URL

- `http://127.0.0.1:3010/`
