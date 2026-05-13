# 2026-05-13 real-db runner 默认远程库修复测试报告

## 目标

- 修复 5 个 `scripts/run-*-real-db-e2e.mjs` 在未显式传 `TEST_DB_*` 环境变量时仍偏向本机 Docker 的风险。
- 验证默认注入已改为远程测试库，并保留显式 `docker` 模式回退能力。

## 执行命令

```powershell
node --test tests/unit/scripts/real-db-runner-remote-defaults.test.mjs tests/unit/scripts/admin-real-db-runner.test.mjs tests/unit/scripts/admin-category-real-db-runner.test.mjs tests/unit/scripts/admin-prompts-management-real-db-runner.test.mjs tests/unit/scripts/test-db-env.test.mjs
```

```powershell
pnpm test:e2e:detail:db
```

## 结果摘要

- `node --test ...`：通过，`12/12` 个测试全部通过。
- `pnpm test:e2e:detail:db`：通过，未额外设置 `TEST_DB_*` 环境变量时，默认使用远程测试库 `10.45.131.70:55432` 完成迁移、seed 和 1 条 Playwright real-db 用例。

## 关键观察

- `db:test:seed` 输出的 `databaseUrl` 为 `postgresql://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/prompt_management_test`，说明默认入口已不再落向本机 Docker 连接串。
- `run-detail-real-db-e2e.mjs` 默认执行完成且未触发 Docker 清理路径，符合 `TEST_DB_MODE=remote` 的预期。
- Playwright 执行期间仅出现 Node `ExperimentalWarning` 与 `MODULE_TYPELESS_PACKAGE_JSON` 警告，不影响本次修复结论。

## 风险与备注

- 当前验证覆盖了 5 个 runner 的单测与 1 条真实入口；其余 4 条 real-db 入口本次未逐条回归。
- 显式 `TEST_DB_MODE=docker` 的兼容行为通过脚本逻辑保留，但本次未做独立 E2E 实跑。
