# 远程 real-db e2e 切换验收报告

- 日期：2026-05-13
- 目标：让 real-db e2e 在显式提供远程测试库环境变量时，不再依赖本机 Docker。

## 本轮改动

- `scripts/prepare-test-db.mjs`
- `scripts/test-db-env.mjs`
- `packages/db/scripts/test-db-migrate.mjs`
- `scripts/run-admin-real-db-e2e.mjs`
- `scripts/run-admin-create-import-real-db-e2e.mjs`
- `scripts/run-admin-category-management-real-db-e2e.mjs`
- `scripts/run-admin-prompts-management-real-db-e2e.mjs`
- `scripts/run-detail-real-db-e2e.mjs`
- `tests/unit/scripts/test-db-env.test.mjs`

## 测试命令与结果摘要

### 1. 单元测试：远程模式识别

命令：

```powershell
node --test tests/unit/scripts/test-db-env.test.mjs
```

结果摘要：

- `4 passed`
- 覆盖点：远程 URL 识别、默认本地模式、探测地址解析、远程模式跳过 Docker 清理。

### 2. 回归测试：现有 real-db runner 静态约束

命令：

```powershell
node --test tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs tests/unit/scripts/admin-real-db-runner.test.mjs tests/unit/scripts/admin-category-real-db-runner.test.mjs
```

结果摘要：

- `3 passed`
- 现有 runner 的锁、独立端口/容器、环境透传约束未回退。

### 3. 远程测试库准备：迁移 + seed

命令：

```powershell
$env:TEST_DATABASE_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test'
$env:TEST_DB_ADMIN_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db'
pnpm run db:test:prepare
```

结果摘要：

- 成功执行 `db:test:migrate`
- 成功执行 `db:test:seed`
- seed 摘要：`categories=4`、`prompts=10`、`promptVersions=17`、`submissions=3`
- 输出中未出现 `db:test:up` / `db:test:down`，说明远程模式未依赖本机 Docker。

### 4. 真实库 E2E：提示词管理入口

命令：

```powershell
$env:TEST_DATABASE_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test'
$env:TEST_DB_ADMIN_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db'
pnpm run test:e2e:admin:prompts:db
```

结果摘要：

- 先成功执行远程 `db:test:prepare`
- Playwright 进入真实用例执行并完成
- `tests/e2e/admin/prompts-management-real-db.spec.ts`: `2 passed`
- 收尾未再调用本机 Docker 清理脚本

## 结论

- 目标命令在显式远程测试库环境变量下已可直接使用远程库完成准备与 E2E。
- Docker 职责仍保留在 `db:test:up/down`，远程分支只在 `prepare` 和 runner 层做最小分流。

## 剩余风险

- 远程模式当前通过连接串 host 自动识别；如果未来存在“本机地址但非 Docker”的特殊接法，需要显式设置 `TEST_DB_MODE=remote`。
- 本轮验收覆盖了 `prompts` real-db 入口；其余 real-db runner 已接入同一跳过清理逻辑，但未逐一做远程实跑。
