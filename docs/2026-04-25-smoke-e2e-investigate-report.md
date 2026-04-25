# 2026-04-25 Smoke E2E 回摆调查报告

## 背景
- 目标：定位并修复 smoke e2e 回摆（首页 500、关键元素缺失、`.next-e2e*` 相关 `MODULE_NOT_FOUND`、`create-import` real-db 请求失败）。
- 范围：仅调整脚本/测试基础设施/最小配置，不改业务功能。

## 根因结论
- 属于同一类 Next dev/e2e 产物一致性问题。
- 关键触发点是 Playwright `webServer.reuseExistingServer: true`：
  - 当端口上已有旧 Next dev 进程时，Playwright 会复用旧进程，跳过 `prebuild-clean + run-next`。
  - 旧进程对应的 dist 产物或环境变量（如 real-db 场景的 `DATABASE_URL`）可能已脏/不匹配，导致 500、关键元素缺失、`MODULE_NOT_FOUND`、创建导入请求失败。
- 另一个放大因素是 real-db 与普通 e2e 未明确隔离 dist 目录，容易在长时间回归中产生交叉污染。

## 本次修复
- Playwright 默认 dist 固定为 `.next-e2e`，避免每次随机端口生成新 dist 名称。
- 强制 `reuseExistingServer: false`，每次测试都以全新 webServer 启动，确保 `prebuild-clean` 生效。
- real-db 三个入口脚本显式注入 `PLAYWRIGHT_WEB_DIST`，使用独立 dist：
  - `create-import`: `.next-e2e-real-db-create-import`
  - `admin`: `.next-e2e-real-db-admin`
  - `detail`: `.next-e2e-real-db-detail`

## 测试命令与结果摘要
```bash
node --test --experimental-strip-types tests/unit/scripts/playwright-webserver-command.test.ts tests/unit/scripts/web-prebuild-clean.test.ts
pnpm exec playwright test tests/e2e/smoke/home.spec.ts tests/e2e/admin/create-import-flow.spec.ts --reporter=line
pnpm test:e2e:admin:create-import:db
pnpm exec playwright test tests/e2e/smoke/home.spec.ts tests/e2e/admin/create-import-flow.spec.ts --reporter=line
```

- unit（脚本基建）：`3 passed`
- smoke 目标集合（第一次）：`7 passed`
- `create-import` real-db：`1 passed`
- smoke 目标集合（第二次复跑）：`7 passed`

## 结论
- 本次修复后，`home.spec.ts` 与 `create-import-flow.spec.ts` 已恢复稳定（连续两次通过）。
- `create-import-real-db.spec.ts` 通过，未复现“提交中 -> 创建失败：请求失败”的回摆现象。
