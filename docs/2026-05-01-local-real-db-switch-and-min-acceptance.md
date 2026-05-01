# 2026-05-01 本地服务切真实库与最小验收报告

- 执行日期：2026-05-01
- 执行人：Codex 子代理
- 目标数据库：`postgres://postgres:postgres@127.0.0.1:55432/prompt_management`
- 最终访问地址：`http://127.0.0.1:3010`

## 1. 背景判断

初始状态下，`http://127.0.0.1:3010/api/prompts/business-data-analysis` 返回：

- HTTP `404`
- 响应体：`{"error":"prompt not found"}`

同时，真实库中已存在该条 Cherry 首批提示词，说明问题不在数据缺失，而在于当前 3010 上的本地 web/API 进程未按目标真实库运行。

## 2. 实际执行命令

### 2.1 确认真库中目标数据已存在

```powershell
docker exec prompt-assets-local-db psql -U postgres -d prompt_management -c "select slug, title from prompts where slug = 'business-data-analysis' limit 5;"
```

结果摘要：

- 查到 `business-data-analysis`
- 标题为 `Business Data Analysis`

### 2.2 用仓库自带 local-debug 重启本地 web

```powershell
pnpm local:web:restart
```

结果摘要：

- 仓库脚本会为 web 注入运行时环境：
  - `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55432/prompt_management`
  - `APP_BASE_URL=http://127.0.0.1:3010`
- 3010 上旧的仓库 web 进程被回收
- 新进程成功接管 `127.0.0.1:3010`
- 启动日志关键片段：
  - `Local: http://127.0.0.1:3010`
  - `Ready in 4.7s`
  - `GET /api/prompts/business-data-analysis 200`

### 2.3 复核当前 3010 监听进程

```powershell
Get-NetTCPConnection -LocalPort 3010 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess | Format-List
Get-CimInstance Win32_Process -Filter "ProcessId = 34912" | Select-Object ProcessId,Name,CommandLine | Format-List
```

结果摘要：

- `3010` 当前监听 PID：`34912`
- 进程为本仓库 `node.exe` / `Next` 启动进程

## 3. 最小验收

### 3.1 API 返回 200

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:3010/api/prompts/business-data-analysis' -UseBasicParsing
```

结果摘要：

- HTTP `200`

### 3.2 Cherry 首批提示词详情可读

```powershell
$targets = @(
  'http://127.0.0.1:3010/api/prompts/business-data-analysis',
  'http://127.0.0.1:3010/api/prompts/meeting-summary'
)
$results = foreach ($u in $targets) {
  $r = Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 10
  $j = $r.Content | ConvertFrom-Json
  [pscustomobject]@{
    url = $u
    status = $r.StatusCode
    slug = $j.slug
    title = $j.title
    versionNo = $j.currentVersion.versionNo
  }
}
$results | ConvertTo-Json -Compress
```

结果摘要：

- `business-data-analysis`：`200`，`Business Data Analysis`，`v0001`
- `meeting-summary`：`200`，`Meeting Summary`，`v0001`

### 3.3 真实库抽样复核

```powershell
docker exec prompt-assets-local-db psql -U postgres -d prompt_management -c "select p.slug, p.title, pv.version_no from prompts p join prompt_versions pv on pv.id = p.current_version_id where p.slug in ('business-data-analysis','meeting-summary') order by p.slug;"
```

结果摘要：

- `business-data-analysis` -> `Business Data Analysis` / `v0001`
- `meeting-summary` -> `Meeting Summary` / `v0001`

## 4. 结论

本次未改业务逻辑代码，仅通过仓库现有 `local-debug` 能力完成本地服务切真实库，并完成最小验收：

1. 当前本地 web/API 已读取 `postgres://postgres:postgres@127.0.0.1:55432/prompt_management`
2. `http://127.0.0.1:3010/api/prompts/business-data-analysis` 返回 `200`
3. 至少一条 Cherry 首批提示词详情已确认可读

当前可访问地址：

- `http://127.0.0.1:3010`
