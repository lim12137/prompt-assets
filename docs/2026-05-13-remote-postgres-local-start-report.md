# 远程 PostgreSQL 本地启动验证报告（2026-05-13）

## 目标

- 将远程 PostgreSQL 连接写入本地启动配置
- 使用该连接完成迁移、seed、启动 web
- 验证 `3010` 监听、`/api/health`、`/`、`/api/prompts`

## 修改文件

- `.env`
- `packages/db/.env`
- `packages/db/package.json`

## 配置说明

- 根 `.env` 写入：
  - `DATABASE_URL=postgres://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db`
  - `POSTGRES_HOST=10.45.131.70`
  - `POSTGRES_PORT=55432`
  - `POSTGRES_DB=app_db`
  - `POSTGRES_USER=app_user`
  - `POSTGRES_PASSWORD=ChangeMe_2026_Strong!`
  - `LOCAL_POSTGRES_*`
  - `LOCAL_APP_BASE_URL=http://127.0.0.1:3010`
- `packages/db/.env` 同步写入 `DATABASE_URL`
- `packages/db/package.json` 的 `db:migrate` / `db:seed` 增加 `node --env-file=.env`

## 执行命令与结果摘要

```powershell
pnpm --filter @prompt-management/db exec node -e "const pg=require('pg'); const c=new pg.Client({connectionString:'postgres://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db', connectionTimeoutMillis:5000}); c.connect().then(()=>c.query('select current_database() as db, current_user as usr')).then(r=>{console.log(JSON.stringify(r.rows[0], null, 2)); return c.end();}).catch(async e=>{console.error(e.message); try{await c.end();}catch{} process.exit(1);});"
```

- 结果：成功连接
- 摘要：`db=app_db`，`usr=app_user`

```powershell
pnpm db:migrate
```

- 结果：成功
- 摘要：
  - `Applied migration: 0001_init.sql`
  - `Applied migration: 0002_multi_category_baseline.sql`
  - `Applied migration: 0003_prompt_version_likes.sql`
  - `Applied migration: 0004_prompt_version_scores.sql`
  - `Applied migration: 0005_prompt_version_daily_interactions.sql`

```powershell
pnpm db:seed
```

- 结果：成功
- 摘要：
  - `databaseUrl=postgres://app_user:***@10.45.131.70:55432/app_db`
  - `categories=4`
  - `prompts=10`
  - `promptVersions=17`
  - `submissions=3`
  - `pendingSubmissions=3`
  - `multiVersionPrompts=6`

```powershell
node .\scripts\local-debug.mjs stop-web
Start-Process -FilePath node -ArgumentList '.\scripts\local-debug.mjs','web' -WorkingDirectory 'D:\1work\提示词管理' -RedirectStandardOutput 'D:\1work\提示词管理\tmp-remote-db-web-3010.out.log' -RedirectStandardError 'D:\1work\提示词管理\tmp-remote-db-web-3010.err.log' -WindowStyle Hidden
```

- 结果：成功
- 摘要：
  - `Next.js 15.5.15`
  - `Local: http://127.0.0.1:3010`
  - `Ready in 5.1s`

```powershell
Get-NetTCPConnection -LocalPort 3010 -State Listen
```

- 结果：成功
- 摘要：`127.0.0.1:3010` 正在监听，`OwningProcess=19076`

```powershell
Invoke-WebRequest http://127.0.0.1:3010/api/health
Invoke-WebRequest http://127.0.0.1:3010/
Invoke-WebRequest http://127.0.0.1:3010/api/prompts
```

- 结果：全部成功
- 摘要：
  - `/api/health` -> `200`
  - `/` -> `200`
  - `/api/prompts` -> `200`

## 过程中的失败点

- 初次直接执行 `pnpm db:migrate` / `pnpm db:seed` 失败，错误为 `connect ECONNREFUSED 127.0.0.1:5432`
- 根因：
  - `packages/db` 脚本未自动加载 `.env`
  - 仅改根 `.env` 或 `packages/db/.env` 不足以让 `db:migrate` / `db:seed` 生效
- 处理：
  - 在 `packages/db/package.json` 为 `db:migrate` / `db:seed` 显式增加 `--env-file=.env`

## 结论

- 已通过现有启动配置完成远程库接入
- 已完成迁移、seed、web 启动
- 本地访问基址：`http://127.0.0.1:3010`
