# 并发测试报告：admin-categories `Connection terminated unexpectedly`（2026-04-25）

## 背景

- 目标：排查 `tests/integration/api/admin-categories.test.ts` 偶发/稳定出现 `Connection terminated unexpectedly`。
- 约束：仅改测试基础设施/DB 生命周期，不改业务功能。

## 执行命令

```bash
pnpm db:test:prepare
node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts
for i in {1..20}; do node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts; done
for i in {1..8}; do node --test --experimental-strip-types tests/integration/api/prompts-list.test.ts tests/integration/api/admin-categories.test.ts tests/integration/api/prompt-create.test.ts tests/integration/api/admin-prompts-import.test.ts tests/integration/api/prompt-detail.test.ts; done
for i in {1..10}; do node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts; done
pnpm db:test:prepare
node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts
```

> 实际在 Windows PowerShell 下执行等价循环命令。

## 结果摘要

- 改动前：
  - 单文件连续跑可通过，但出现过首条用例明显异常耗时（等待 DB 生命周期操作）。
  - 历史记录显示同阶段存在 `db:test:prepare`/`db:test:seed` 掉线与 `Connection terminated unexpectedly`。
- 根因判定：
  - `admin-categories.test.ts` 在测试执行期间会在 `isPgReachable` 失败时触发 `db:test:prepare`。
  - `db:test:prepare -> db:test:up` 会 `docker rm -f` 后重建测试库容器，属于破坏性 DB 生命周期操作。
  - 该时序可中断正在进行的连接/事务，表现为 `Connection terminated unexpectedly`。
  - 结论偏向：`prepare/down 时序 + 测试前置策略` 问题，不是连接池（本仓库 `withPgClient` 使用单次 `pg.Client`，非池化）。
- 改动后：
  - 移除测试运行中自动 `db:test:prepare` 的路径，改为一次 reachability 检查；不可达时整文件用例 `skip`。
  - 在 DB 可达场景，`admin-categories` 可稳定通过（最终验证：`8 pass / 0 fail / 0 skip`）。
  - 在 DB 不可达场景，不再触发连接中断失败，而是可控 `skip`。

## 结论

- 已将失败模式从“运行中破坏性重建 DB 导致连接中断”收敛为“DB 不可达时跳过”。
- `tests/integration/api/admin-categories.test.ts` 在可达环境下通过，且不再在测试中触发 DB 容器生命周期抖动。
