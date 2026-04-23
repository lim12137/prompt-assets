# Task 6 TDD 测试报告（Seed Data / Fixtures）

## 1) 失败用例阶段（Red）

命令：

```bash
node --test --experimental-strip-types tests/integration/db/seed.test.ts
```

结果摘要：

- 失败，`seed.test.ts` 导入的 `packages/db/src/seed.ts` 不存在。
- 说明失败测试先行生效，符合 TDD Red 阶段预期。

关键报错（摘录）：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../packages/db/src/seed.ts'
```

## 2) 实现阶段（Green）

实现内容（最小闭环）：

- 新增 `tests/fixtures/prompts.ts`，导出：
  - `baseCategories`
  - `promptCatalog`
  - `pendingSubmissionFixture`
- 新增 `packages/db/src/seed.ts`，实现：
  - `seedPlan`（基于 fixture 的统计）
  - `seedDatabase(connectionString, { reset })`（事务化种子写入）
  - users/categories/prompts/prompt_versions/submissions/prompt_likes 的最小可用 upsert
- 新增 `tests/integration/db/seed.test.ts`，断言：
  - 分类 `>=3` 且包含 `内容创作/编程/设计`
  - prompts `>=10`
  - pending 数据 `>=2`
  - 至少 1 个 prompt 有多版本
  - 真实 DB 可达时执行落库规模断言，不可达时 skip
- 更新 `packages/db/package.json`：
  - `db:test` 同时执行 `schema.test.ts + seed.test.ts`

## 3) 回归结果

命令：

```bash
node --test --experimental-strip-types tests/integration/db/seed.test.ts
```

结果摘要：

- 通过：`pass 4`
- 跳过：`skipped 1`（真实 DB 不可达）
- 失败：`0`

命令：

```bash
pnpm --filter @prompt-management/db db:test
```

结果摘要：

- 通过：`pass 7`
- 跳过：`skipped 3`（真实 DB 不可达）
- 失败：`0`

## 4) 环境阻塞验证（真实 Postgres）

命令：

```bash
pnpm --filter @prompt-management/db db:test:up
```

结果摘要：

- 失败，当前环境无法从 Docker Hub 拉取 `postgres:16-alpine`。
- 因此无法在本机完成真实 PG 容器启动与后续 `seed` 落库验收。

关键报错（摘录）：

```text
failed to resolve reference "docker.io/library/postgres:16-alpine"
dial tcp ...:443: connectex ... failed to respond
```

## 5) 静态可验证项与环境阻塞项

静态可验证项（已完成）：

- 固定分类数据满足：`>=3` 且包含 `内容创作/编程/设计`。
- 固定 Prompt 数据满足：`>=10`。
- `pendingSubmissionFixture` 满足：`pending >=2`。
- 多版本 Prompt 满足：至少 1 条（实际多条）。
- `db:test` 已纳入 `seed` 集成测试。

环境阻塞项（待环境恢复后验证）：

- 真实 Postgres 容器启动（`db:test:up`）。
- 真实 DB 迁移与种子落库后的端到端数据校验（`seed.test.ts` 中真实 DB 断言分支）。
