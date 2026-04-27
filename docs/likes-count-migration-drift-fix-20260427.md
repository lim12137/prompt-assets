# likes_count 迁移漂移修复收尾报告（2026-04-27）

## 根因
- 历史库存在迁移漂移：`__prompt_management_migrations` 已记录 `0003_prompt_version_likes.sql`，但实际库中缺失 `prompt_versions.likes_count` 字段。
- 旧逻辑只按迁移记录判断“已应用”，不会再次执行该 SQL，导致后续读取/写入版本点赞计数时出现字段缺失报错。

## 本次修复
- 在 `packages/db/scripts/migrate.mjs` 增加漂移补偿逻辑：
  - 当 `0003_prompt_version_likes.sql` 已记录时，额外检查 `prompt_versions.likes_count` 是否存在。
  - 若缺失则执行 `ALTER TABLE "prompt_versions" ADD COLUMN IF NOT EXISTS "likes_count" integer DEFAULT 0 NOT NULL`。
  - 返回值新增 `repaired`，并输出 `Repaired migration drift...` 日志。
- 在 `tests/unit/db/migrate-script.test.mjs` 增加单测，覆盖“迁移已记录但字段缺失时执行补偿”场景。

## 执行命令与结果
1. `node --test tests/unit/db/migrate-script.test.mjs`
   - 结果：`4 passed, 0 failed`（包含新补偿场景）。
2. `node --test --experimental-strip-types tests/integration/api/prompt-version-like.test.ts`
   - 结果：`5 passed, 0 failed`。
3. `pnpm exec playwright test tests/e2e/smoke/prompt-detail-like.spec.ts`
   - 结果：`1 passed`。
4. `pnpm test:e2e:detail:db`
   - 首次失败：测试库端口 `55432` 被占用（非代码问题）。
5. `$env:TEST_DB_PORT='55433'; $env:TEST_DATABASE_URL='postgres://postgres:postgres@127.0.0.1:55433/prompt_management_test'; pnpm test:e2e:detail:db`
   - 结果：真实 DB 详情链路 E2E `1 passed`，测试容器已正常清理。

## 页面/API/QA 结果摘要
- 页面：详情页版本点赞交互用例通过（点赞后计数与按钮状态正确变化）。
- API：版本点赞接口（首次点赞、幂等、取消点赞、版本隔离、不存在版本）全部通过。
- QA：真实 DB 详情主链路通过，迁移、seed、详情页 E2E 全链路通过。

## 结论
- “迁移漂移导致 `likes_count` 缺失”的原问题已修复。
- 验收通过，且本次验证结果已落盘到本报告。
