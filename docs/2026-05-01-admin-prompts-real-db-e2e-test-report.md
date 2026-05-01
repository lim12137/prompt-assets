# 2026-05-01 提示词管理真实库整链路 E2E 测试报告

## 目标

补一条不依赖 `page.route` 全量桩的管理页真实库整链路 E2E，覆盖：

- 管理员登录态进入真实页面
- 在真实测试库中创建一条新提示词
- 进入 `/admin/prompts` 管理页
- 执行一次真实管理动作（归档）
- 刷新后验证状态持久化

## 新增文件

- `tests/e2e/admin/prompts-management-real-db.spec.ts`
- `scripts/run-admin-prompts-management-real-db-e2e.mjs`
- `tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs`

## TDD 记录

### Red

先新增 runner 单测，再执行：

```powershell
node --test tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

结果：失败。

摘要：

- 缺少文件 `scripts/run-admin-prompts-management-real-db-e2e.mjs`

### Green

补齐独立 runner 与 npm 命令后重跑：

```powershell
node --test tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

结果：通过，`1 passed / 0 failed`。

首次执行真实库 E2E 时再次暴露一处环境级问题：

- `prepare-test-db` 阶段 seed 落到了默认 `55432`
- 新 runner 使用的是 `55435`
- 导致页面只加载到系统 `uncategorized`，拿不到 `编程`

修复方式：

- 在 `scripts/run-admin-prompts-management-real-db-e2e.mjs` 中显式透传 `TEST_DATABASE_URL`

## 最终执行命令

```powershell
node --test tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs
```

```powershell
pnpm run test:e2e:admin:prompts:db
```

## 最终结果

### 1) runner 单测

- 结果：`1 passed / 0 failed`

### 2) 真实库管理页 E2E

- 结果：`1 passed / 0 failed`
- 用例：`真实 DB: 管理员进入提示词管理页并完成归档链路`

## 链路说明

该 E2E 实际覆盖了以下真实链路：

1. 使用真实登录 token cookie 进入后台
2. 访问 `/admin/create`
3. 在真实测试库中创建一条唯一 prompt
4. 访问 `/admin/prompts`
5. 用关键词过滤定位新建 prompt
6. 点击 `归档`
7. 刷新页面后再次验证该 prompt 仍为 `已归档`

## 结论

本次新增的管理页真实库整链路 E2E 已落地，可直接通过：

```powershell
pnpm run test:e2e:admin:prompts:db
```

复跑，且验证链路不依赖 `page.route` 全量桩。

## 残余风险

- 当前只覆盖了“创建后归档”这一条真实管理动作，尚未扩到“恢复发布 / 彻底删除 / 多分类重分类”整链路。
- 运行日志仍有 Node 的 `Type Stripping` 与 `MODULE_TYPELESS_PACKAGE_JSON` 警告，但不影响本次测试结论。
