# 并发/验收报告草稿（2026-04-25）

## 1. 本次排查用到的测试命令

```bash
pnpm db:test:prepare
node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts
pnpm exec playwright test tests/e2e/smoke/home.spec.ts tests/e2e/admin/create-import-flow.spec.ts --reporter=line
pnpm test:e2e:admin:create-import:db
```

补充说明（并发复现/稳定性观察）：

```powershell
# PowerShell 等价循环（示例）
1..20 | ForEach-Object { node --test --experimental-strip-types tests/integration/api/admin-categories.test.ts }
1..8 | ForEach-Object { node --test --experimental-strip-types tests/integration/api/prompts-list.test.ts tests/integration/api/admin-categories.test.ts tests/integration/api/prompt-create.test.ts tests/integration/api/admin-prompts-import.test.ts tests/integration/api/prompt-detail.test.ts }
```

## 2. 当前已知结果摘要

- `admin-categories` 相关故障模式已定位为测试期间触发破坏性 DB 生命周期操作（`db:test:prepare`/重建容器）导致连接被中断，表现为 `Connection terminated unexpectedly`。
- 在“移除测试运行中自动 prepare、改为可达性检查并在不可达时 skip”的策略下，可达环境执行结果为通过（历史验证样例：`8 pass / 0 fail / 0 skip`）；不可达环境转为可控跳过而非连接中断失败。
- smoke 与 real-db 相关链路已完成一轮稳定性修复验证（`home.spec.ts`、`create-import-flow.spec.ts`、`create-import-real-db.spec.ts` 均有通过记录，且目标集合存在连续复跑通过记录）。
- 目前该文档为验收草稿，待主修复合入后进行最终补跑确认。

## 3. 待主修复完成后需补跑的验证项

- 补跑 `admin-categories` 单测/集成稳定性：先单次、再多轮循环（建议 `20` 轮），确认无 `Connection terminated unexpectedly`。
- 补跑包含 `admin-categories` 的 API 组合并发回归（建议 `8` 轮），确认无 DB 生命周期抖动引发的级联失败。
- 补跑 smoke 关键链路两轮连续执行：`home.spec.ts` + `create-import-flow.spec.ts`，确认不存在复用旧进程/脏 dist 回摆。
- 补跑 `pnpm test:e2e:admin:create-import:db`，确认 real-db 创建导入链路稳定通过。
- 若补跑中出现失败，需在报告中补充：失败命令、首个失败时间点、失败日志关键摘要、是否可稳定复现。

## 4. 验收判定（草稿）

- 通过门槛（建议）：
  - 上述补跑项全部通过；
  - 无新增阻断级别失败；
  - 同类问题（连接中断、旧进程复用导致产物不一致）不再复现。
- 当前状态：`待主修复后补跑`。

