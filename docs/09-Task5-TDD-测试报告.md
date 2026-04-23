# Task 5 TDD 测试报告（DB Schema/Migration）

## 1) 失败用例阶段（Red）

命令：

```bash
pnpm --filter @prompt-management/db db:test
```

结果摘要：

- 失败，错误为 `schema.ts` 未导出 `coreTableNames`。
- 说明测试先行生效，当前实现不满足新断言。

关键报错：

```text
SyntaxError: The requested module '../../../packages/db/src/schema.ts' does not provide an export named 'coreTableNames'
```

## 2) 实现阶段（Green）

实现内容（最小）：

- 在 `packages/db/src/schema.ts` 新增 `coreTableNames`、`coreUniqueConstraints`。
- 在 `packages/db/src/client.ts` 新增 `isPgReachable()`，用于真实 DB 断言的可达性探测。
- 在 `tests/integration/db/schema.test.ts` 拆分为：
  - 静态断言（读取 `migrations/0001_init.sql`，本地可通过）。
  - 真实 DB 断言（可达时执行，不可达时 skip）。

回归命令：

```bash
pnpm --filter @prompt-management/db db:test
```

结果摘要：

- 通过：`pass 3`
- 跳过：`skipped 2`（真实 DB 不可达）
- 失败：`0`

## 3) 真实 Postgres 集成阻塞验证

命令：

```bash
pnpm --filter @prompt-management/db db:test:up
```

结果摘要：

- 失败，当前环境无法拉取 `postgres:16-alpine`，导致测试库容器无法启动。
- 因此无法完成本机真实 Postgres 的端到端迁移验证。

关键报错（摘录）：

```text
Unable to find image 'postgres:16-alpine' locally
failed to resolve reference "docker.io/library/postgres:16-alpine"
```

## 4) 已完成与待环境验证项

已完成：

- 核心表存在性（`users/categories/prompts/prompt_versions/submissions/prompt_likes/audit_logs`）静态断言。
- 关键唯一约束存在性（`prompts.slug`、`prompt_versions(prompt_id,version_no)`、`prompt_likes(prompt_id,user_id)`）静态断言。
- `role=user/admin` 与“`submission` 为审核对象、正文在 `prompt_versions` 单写”静态断言。

待环境验证：

- 启动可用 Postgres（建议 GHCR 镜像源）后，执行真实 DB 断言与迁移落库验收：
  - `pnpm --filter @prompt-management/db db:test:up`
  - `pnpm --filter @prompt-management/db db:test:migrate`
  - `pnpm --filter @prompt-management/db db:test`
  - `pnpm --filter @prompt-management/db db:test:down`
