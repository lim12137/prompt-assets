# Admin 真实 DB 测试报告

日期：2026-04-24

## 目标

- 使用 Docker PostgreSQL 跑通至少一条 admin 管理相关真实数据库链路。
- 验证链路必须走真实数据库，不漂到 fixture。
- 将前置编排收敛为可重复执行的命令。

## 根因

- `docker-compose.yml` / `.env.example` 默认库名为 `prompt_assets`，但代码和 DB 脚本默认值是 `prompt_management`，本地接库时容易错库。
- 仓库已有 `packages/db/src/seed.ts`，但没有标准 CLI 入口，导致“迁移后写入种子数据”只能手工拼。
- Playwright 没有真实 DB 前置编排，admin 链路即使能起页面，也会因为没有 seed 数据在审核时落到 `submission not found`。
- 现有 `db:test:up` 默认依赖 `postgres:16-alpine` 拉取；当前环境无法访问 Docker Hub，需要优先复用本地 GHCR PostgreSQL 镜像。

## 测试命令与结果

### 红灯

```powershell
pnpm db:test:up
pnpm db:test:migrate
$env:DATABASE_URL='postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test'
$env:PROMPT_REPOSITORY_DATA_SOURCE='auto'
pnpm exec playwright test tests/e2e/admin/management-real-db.spec.ts
```

结果摘要：

- `db:test:up`：成功，测试容器启动。
- `db:test:migrate`：成功，应用 `0001_init.sql`。
- `management-real-db.spec.ts`：失败，管理链路在 approve 时返回 `submission not found`。
- 结论：真实 DB 已接通，但缺少 seed，admin 管理链路不可用。

### 绿灯：手工闭环

```powershell
pnpm db:test:seed
$env:DATABASE_URL='postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test'
$env:PROMPT_REPOSITORY_DATA_SOURCE='auto'
pnpm exec playwright test tests/e2e/admin/management-real-db.spec.ts
```

结果摘要：

- `db:test:seed`：成功，写入 `3 categories / 10 prompts / 16 promptVersions / 2 submissions`。
- `management-real-db.spec.ts`：`1 passed`。
- 结论：seed 后，管理页可从真实 DB 读取 pending 列表，并完成一次 approve。

### 绿灯：最终入口命令

```powershell
pnpm db:test:prepare
pnpm test:e2e:admin:db
```

结果摘要：

- `db:test:prepare`：成功，自动完成 `起库 -> migrate -> seed`。
- `test:e2e:admin:db`：成功，自动完成 `起库 -> migrate -> seed -> admin 真实 DB E2E -> 清理容器`。
- Playwright 结果：`1 passed`。

## 产出

- 新增标准命令：`db:seed`、`db:test:seed`、`db:test:prepare`、`test:e2e:admin:db`。
- 新增真实 DB admin Playwright 用例：`tests/e2e/admin/management-real-db.spec.ts`。
- 测试 DB 启动脚本会优先复用本地可用 GHCR PostgreSQL 镜像，并在 prepare 阶段等待主机端口就绪。
