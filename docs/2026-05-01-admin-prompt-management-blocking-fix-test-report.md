# 2026-05-01 提示词管理阻断修复测试报告

## 范围

- 后台提示词管理不再因“0 个已发布 prompt”静默回退到 fixture
- 管理列表在状态筛选下归档/恢复后重新按当前筛选收敛
- 管理详情页状态标签样式跟随真实状态

## TDD 记录

### 红灯

1. `node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts`
   - 结果：失败
   - 摘要：
     - `GET /api/admin/prompts 在 0 个已发布 prompt 时仍读取真实库管理数据` 返回 0 条
     - 多个管理接口落到 fixture，出现 `404 !== 200`
2. `pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --reporter=line`
   - 结果：失败
   - 摘要：
     - 新增前端用例命中了筛选后列表未收敛的问题
     - 首轮运行同时遇到 `.next-e2e` 目录下的 Next dev 缓存/内存异常，后续改用独立 dist 目录复验

### 绿灯

1. `node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts`
   - 结果：7/7 通过
2. `node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts tests/integration/api/audit-log.test.ts`
   - 结果：11/11 通过
3. `$env:PLAYWRIGHT_WEB_DIST='.next-e2e-admin-prompts-fix'; $env:PLAYWRIGHT_WEB_PORT='36120'; pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --reporter=line`
   - 结果：4/4 通过

## 结果摘要

- 后台管理列表、分类更新、归档、恢复、彻底删除，均改为只要数据库与表可用就走真实库
- 新增集成测试覆盖“0 个已发布 prompt”场景，验证列表和分类更新不会回退到 fixture
- 管理列表在“仅看已发布 / 仅看已归档”下执行状态操作后，会重新请求并刷新当前筛选结果
- 管理详情页状态标签现在会按 `published / archived / draft` 显示对应样式

## 注意事项

- Playwright 运行建议继续使用独立 `PLAYWRIGHT_WEB_DIST`，避免复用历史 `.next-e2e` 缓存导致的异常
- 集成测试里在 `resetDbSeed()` 后显式清理了仓库层缓存，避免 `canReadFromDatabase()` 的 5 秒缓存影响串行用例
