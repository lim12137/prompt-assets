# Web 3010 重启并切换远程 PostgreSQL 验收报告（2026-05-13）

## 执行目标
- 安全停止旧的 `3010` Web 监听进程；
- 复用项目既有启动方式重启 Web；
- 验证 `3010` 监听、`/api/health`、`/`、`/api/prompts`；
- 证明 `/api/prompts` 返回 Cherry 导入后的真实库数据（非旧 seed）。

## 执行命令与结果摘要
1. 定位 `3010` 监听 PID
```powershell
Get-NetTCPConnection -LocalPort 3010 -State Listen | Select-Object LocalAddress,LocalPort,OwningProcess
```
结果：旧 PID=`19076`。

2. 校验旧进程命令行（确认是本项目 Web）
```powershell
Get-CimInstance Win32_Process -Filter "ProcessId = 19076" | Select-Object ProcessId,Name,CommandLine
```
结果：`node ... next/dist/server/lib/start-server.js`（本项目 Next Web 进程）。

3. 安全停止旧进程（仅该 PID）
```powershell
Stop-Process -Id 19076 -ErrorAction Stop
```
结果：`3010` 端口已清空（`PORT_3010_CLEARED`）。

4. 使用既有方式重启 Web
```powershell
pnpm dev:web
```
后台拉起结果：启动器 PID=`14804`，实际监听进程 PID=`27736`。

5. 远程数据库配置核验（当前 .env）
```powershell
Select-String -Path .env -Pattern "DATABASE_URL|POSTGRES_HOST|POSTGRES_PORT|POSTGRES_DB|POSTGRES_USER"
```
结果关键值：
- `DATABASE_URL=postgres://app_user:***@10.45.131.70:55432/app_db`
- `POSTGRES_HOST=10.45.131.70`
- `POSTGRES_PORT=55432`

6. 服务可用性验收
```powershell
Invoke-WebRequest http://127.0.0.1:3010/api/health
Invoke-WebRequest http://127.0.0.1:3010/
Invoke-WebRequest "http://127.0.0.1:3010/api/prompts?limit=20"
```
结果：
- `/api/health` -> `{"status":"ok"}`
- `/` -> `200`（内容长度 `121577`）
- `/api/prompts` -> 返回 JSON 列表，含大量中文化角色数据与“官方原名”字段。

## Cherry 真实库数据证据（非旧 seed）
从 `/api/prompts` 返回中抽样到以下记录（slug/title）：
- `writing-materials-collector` / `写作资料采集助手`
- `journalist` / `新闻写作记者`
- `academic-researcher` / `学术研究助手`

补充佐证：
- 多条记录 `currentVersionContent` 含“官方原名：...”，符合 Cherry 导入包内容形态；
- 更新时间集中在 `2026-05-12T17:47:2xZ`，与近期导入批次一致，不是常见初始 seed 结构。

## 最终状态
- 当前 `3010` 监听 PID：`27736`
- 服务地址：`http://127.0.0.1:3010`
- 验收结论：通过。
