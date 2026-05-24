# 2026-05-12 无 Docker daemon 备用起页调查与验证报告

## 目标

- 在不改业务代码的前提下，寻找并尽可能执行一个不依赖当前 Docker daemon 的备用启动方案。
- 优先验证 `http://127.0.0.1:3010/` 是否至少可访问。

## 调查结论

### 1. 已有远程数据库支持

- `packages/db/src/resolve-database-url.ts`
  - 支持 `DATABASE_URL`
  - 也支持 `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` 组合装配连接串
- 结论：项目可连接已有远程 PostgreSQL，不强制必须由当前 Docker daemon 起库。

### 2. 存在 fixture/mock 式数据回落，但不是“零 DB 环境变量”启动

- `apps/web/lib/api/prompt-repository.ts`
  - 支持 `PROMPT_REPOSITORY_DATA_SOURCE=fixture`
  - `listPrompts()` / `getPromptDetail()` 等读链路在 `fixture` 模式下回落到 `tests/fixtures/prompts.ts`
- `apps/web/lib/env.ts`
  - 启动期仍要求 `DATABASE_URL`，缺失会抛 `DATABASE_URL is required`
- 结论：存在“不连真实库也能起页”的 fixture 备用模式，但仍需提供一个占位 `DATABASE_URL`。

### 3. 未发现 sqlite 支持

- 仓库业务代码未提供 sqlite 驱动接线
- `pnpm-lock.yaml` 中虽出现 drizzle 对 sqlite 的可选 peer 提示，但项目实际 `packages/db/src/client.ts` 使用的是 `pg` / `node-postgres`
- 结论：当前项目无可直接启用的 sqlite 备用启动方案。

### 4. 未发现显式“跳过 migrate/seed”的独立启动脚本（当时）

- `local-debug.mjs` 当时默认 `dev` 链路为 `db-up -> db-migrate -> db-seed -> web`
- 但 web 运行时仓储层自身具备 DB 不可达时的 fixture 回落能力
- 结论：没有官方“skip migrate/seed”专用脚本；但对首页等读场景，fixture 模式可绕开真实迁移/seed 依赖。

### 5. 存在“仅前端/仅 web 起页”入口

- 根脚本：`pnpm dev:web`
- 对应：`pnpm --filter @prompt-management/web dev --hostname 127.0.0.1 --port 3010`
- 结论：存在只起 web 的入口，不必走 `local:dev` 的 Docker 编排。

## 最小启动尝试

### 执行命令

```powershell
$env:DATABASE_URL='postgres://postgres:postgres@127.0.0.1:59999/prompt_management'
$env:PROMPT_REPOSITORY_DATA_SOURCE='fixture'
$env:APP_BASE_URL='http://127.0.0.1:3010'
$env:NEXT_STARTUP_HEALTH_CHECK='0'
$env:NEXT_RUNTIME_HEALTH_CHECK='0'
Start-Process -FilePath 'pnpm.cmd' `
  -ArgumentList 'dev:web' `
  -WorkingDirectory 'D:\1work\提示词管理' `
  -RedirectStandardOutput 'D:\1work\提示词管理\tmp-fixture-web-3010.out.log' `
  -RedirectStandardError 'D:\1work\提示词管理\tmp-fixture-web-3010.err.log' `
  -WindowStyle Hidden
```

### 验证命令

```powershell
Invoke-WebRequest -Uri 'http://127.0.0.1:3010/api/health' -UseBasicParsing -TimeoutSec 10
Invoke-WebRequest -Uri 'http://127.0.0.1:3010/' -UseBasicParsing -TimeoutSec 20
Invoke-WebRequest -Uri 'http://127.0.0.1:3010/api/prompts' -UseBasicParsing -TimeoutSec 20
Get-Content -Raw 'D:\1work\提示词管理\tmp-fixture-web-3010.out.log'
Get-Content -Raw 'D:\1work\提示词管理\tmp-fixture-web-3010.err.log'
```

## 结果摘要

- `GET /api/health`：`200`
- `GET /`：`200`
- `GET /api/prompts`：`200`
- `/api/prompts` 返回 `10` 条 fixture 数据，首条 `slug` 为 `ux-research-plan`
- 首页响应体包含提示词相关文案，说明页面已可访问
- 错误日志文件为空

启动日志关键片段：

```text
Local:        http://127.0.0.1:3010
Ready in 5.1s
GET /api/health 200
GET /api/prompts 200
GET / 200
```

## 当前结论

- 存在可行备用方案：`pnpm dev:web` + `PROMPT_REPOSITORY_DATA_SOURCE=fixture` + 占位 `DATABASE_URL`
- 该方案不依赖当前 Docker daemon，也不依赖当前本地 PostgreSQL 可达
- 该方案适合“首页/API 只读起页验证”
- 该方案不是完整真实库方案：
  - 部分管理链路仍有直接 DB 写入/查询依赖
  - 它不能替代真实 PostgreSQL 的迁移、seed、管理后台全链路验收
