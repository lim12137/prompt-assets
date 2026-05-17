# 首页 AI 工具 env 化迁移验证报告

日期：2026-05-17

## 变更目标

将首页 AI 工具配置从 `apps/web/app/_home/home-ai-tools.ts` 迁移为 env 驱动，保持首页 3 个小卡片展示不变，并补齐默认值与启动前校验。

## 验证命令

1. `node --test --experimental-strip-types apps/web/lib/home-ai-tools-env.test.ts`
2. `node --test --experimental-strip-types apps/web/scripts/run-next-env-validation.test.ts`
3. `node --test --experimental-strip-types tests/unit/env/env.test.ts apps/web/lib/home-ai-tools-env.test.ts apps/web/scripts/run-next-env-validation.test.ts`
4. `pnpm exec playwright test tests/e2e/smoke/home-ai-tools.spec.ts`

## 结果摘要

- 命令 1：通过。覆盖默认值、env 覆盖、排序、重复 slug、未知 slug 必填项、卡片数量固定为 3 的校验。
- 命令 2：通过。确认 `run-next.mjs` 在启动前会执行 env fail-fast 校验。
- 命令 3：通过。确认扩展 `parseAppEnv` 后未回归既有 `DATABASE_URL` / `APP_BASE_URL` 语义。
- 命令 4：通过。首页 AI 工具区 smoke 通过，现有 3 张卡片可见、外链属性正常、无额外管理入口混入。

## 备注

- Node `--experimental-strip-types` 运行测试时会出现 `MODULE_TYPELESS_PACKAGE_JSON` 警告，但不影响测试通过。
