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

## 2026-05-13 补充验收：剩余 real-db 入口远程实跑

### 测试命令

```powershell
$env:TEST_DATABASE_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test'
$env:TEST_DB_ADMIN_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db'
pnpm run test:e2e:admin:db
pnpm run test:e2e:admin:create-import:db
pnpm run test:e2e:admin:category-management:db
pnpm run test:e2e:detail:db
```

说明：

- 用户需求里写的是 `test:e2e:admin:category:db`，仓库内实际可执行脚本名为 `test:e2e:admin:category-management:db`，本轮按实际脚本名执行。

### 结果摘要

- `pnpm run test:e2e:admin:db`
  - 结果：失败，`management-flow.spec.ts` 为 `2 passed, 1 failed`
  - 失败点：`await expect(rows).toHaveCount(2)` 实际拿到 `3`
  - 归因：测试问题 / 测试数据问题
  - 判断依据：远程 seed 摘要稳定为 `submissions=3`、`pendingSubmissions=3`，而用例仍硬编码假设管理页初始待审核数为 `2`

- `pnpm run test:e2e:admin:create-import:db`
  - 结果：失败，`create-import-real-db.spec.ts` 超时
  - 失败点：访问 `/admin/create` 后被重定向到 `/login?redirect=%2Fadmin%2Fcreate`，`getByLabel("标题")` 一直不可用
  - 归因：测试问题
  - 判断依据：该 real-db 用例未注入 admin 登录 cookie，也未在 runner 中补登录态；失败发生在业务执行前，不是远程库切换失败

- `pnpm run test:e2e:admin:category-management:db`
  - 结果：失败，`category-management-real-db.spec.ts` 超时
  - 失败点：创建页等待按钮 `提交创建` 超时
  - 归因：测试问题
  - 判断依据：当前页面实现 `apps/web/app/admin/create/page.jsx` 的提交按钮文案已是 `提交审核`，用例选择器仍使用旧文案 `提交创建`

- `pnpm run test:e2e:detail:db`
  - 结果：失败，`prompt-detail-real-db.spec.ts` 为 `1 failed`
  - 失败点：候选提交后未出现 `提交成功`，页面实际提示 `提交失败：请先登录后再提交候选迭代`
  - 归因：测试问题
  - 判断依据：页面错误快照明确显示未登录态；失败原因为候选提交流程缺少登录前置，不是远程数据库或模式切换失败

### 补充结论

- 四个剩余入口都已完成远程测试库实跑。
- 本轮未发现“远程模式切换错误导致 runner 无法准备数据库或误触发本机 Docker 清理”的证据。
- 当前阻断点集中在用例前置与断言过期：
  - admin 管理流：待审核数量假设与当前 seed 不一致
  - create/import：缺少 admin 登录前置
  - category-management：按钮文案断言过期
  - detail：缺少员工登录前置

## 2026-05-13 补充验收：过期 real-db 用例重写与修复

### 本轮测试相关改动

- `tests/e2e/auth-helpers.ts`
- `tests/e2e/admin/management-flow.spec.ts`
- `tests/e2e/admin/create-import-real-db.spec.ts`
- `tests/e2e/admin/category-management-real-db.spec.ts`
- `tests/e2e/smoke/prompt-detail-real-db.spec.ts`

### 测试命令

```powershell
$env:TEST_DATABASE_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test'
$env:TEST_DB_ADMIN_URL='postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db'
pnpm run test:e2e:admin:db
pnpm run test:e2e:admin:create-import:db
pnpm run test:e2e:admin:category-management:db
pnpm run test:e2e:detail:db
```

### 结果摘要

- `pnpm run test:e2e:admin:db`
  - 结果：通过，`3 passed`
  - 修复点：把 `management-flow.spec.ts` 中写死的初始待审核数量 `2` 改为基于 seed 实际数据做动态断言，验证 approve/reject 后数量递减。

- `pnpm run test:e2e:admin:create-import:db`
  - 结果：通过，`1 passed`
  - 修复点：
    - 补 admin 登录 cookie 前置
    - 创建页按钮文案从旧的 `提交创建` 对齐为当前 `提交审核`
    - 创建状态文案从旧的 `创建请求提交中` 对齐为当前 `审核请求提交中`
    - 导入页 textarea 不再依赖“精确覆盖默认示例”的旧假设，改为显式替换值并验证导入成功

- `pnpm run test:e2e:admin:category-management:db`
  - 结果：通过，`1 passed`
  - 修复点：
    - 补 admin 登录 cookie 前置
    - 创建页按钮文案从旧的 `提交创建` 对齐为当前 `提交审核`

- `pnpm run test:e2e:detail:db`
  - 结果：通过，`1 passed`
  - 修复点：
    - 补员工登录 cookie 前置
    - 去掉硬编码候选版本号断言
    - reload 后按本次提交 `marker` 过滤候选卡，避免多张候选卡导致 strict mode 失败

### 最终结论

- 四条目标入口均已在远程真实数据库环境下实跑通过。
- 本轮只修改测试与测试报告；未修改产品代码。
- 剩余失败：无。
