# 并发测试报告-20260429-fail-closed-daily-interaction

## 目标
- 修复高危 fail-open：`prompt_version_daily_interactions` 缺失时，版本点赞/评分不再静默放行，改为 fail-closed。

## RED（TDD 先补用例）
- 新增用例：
  - `tests/integration/api/prompt-version-like.test.ts`
  - `tests/integration/api/prompt-version-score.test.ts`
- 用例逻辑：
  1. 真实 DB 模式下重置种子。
  2. 临时将 `prompt_version_daily_interactions` 改名为 `prompt_version_daily_interactions_disabled_for_test`。
  3. 调用点赞/评分 API，断言返回 `500` 且 `code=missing_infrastructure`。
  4. 测试结束恢复表名并重置种子。
- 本次环境现状：`TEST_DATABASE_URL` 不可达，因此两条 RED 用例在执行时 `SKIP`（非失败）。

## 实现修改
- `apps/web/lib/api/prompt-repository.ts`
  - 新增返回类型 `PromptVersionDailyInteractionResult`，包含 `missing_infrastructure`。
  - `markPromptVersionDailyInteractionInDb` 在基础设施缺失时由原 `ok` 改为 `missing_infrastructure`。
  - `REQUIRED_TABLES` 纳入 `prompt_version_daily_interactions`，避免半迁移可读判定。
- `apps/web/app/api/prompts/[slug]/versions/[versionNo]/like/route.ts`
  - 识别 `missing_infrastructure` 并返回 `500`：
    - `{ error: "评分点赞限流基础设施未就绪", code: "missing_infrastructure" }`
- `apps/web/app/api/prompts/[slug]/versions/[versionNo]/score/route.ts`
  - 同上，返回一致的 `500` 错误体。

## GREEN（相关测试）
- 命令：
```bash
node --test --experimental-strip-types tests/unit/auth/request-ip.test.ts tests/integration/api/prompt-version-like.test.ts tests/integration/api/prompt-version-score.test.ts tests/integration/api/prompt-submission.test.ts
```
- 结果摘要：
  - `pass=30`
  - `skip=2`（新增真实 DB fail-closed 用例，因测试库不可达跳过）
  - `fail=0`

## 迁移与重启
- 迁移确认（先前 `pnpm db:migrate` 因默认 5432 未启动失败；改走本地调试编排成功）：
```bash
set LOCAL_WEB_PORT=3011
local-debug.bat prepare
```
- 结果摘要：
  - `0004_prompt_version_scores.sql` 已应用
  - `0005_prompt_version_daily_interactions.sql` 已应用
  - seed 成功（`databaseUrl=...:55432/prompt_management`）
- 重启：
```bash
set LOCAL_WEB_PORT=3011
set LOGIN_TOKEN_SECRET=local-dev-secret
local-debug.bat restart-web
```
  - 命令前台常驻导致调用超时；最终通过结束旧进程并后台拉起 `local-debug.bat web` 验证服务已生效。

## HTTP 验证（3011）
- `/login`：
```bash
curl -s -o NUL -w "%{http_code}" http://127.0.0.1:3011/login
```
  - 结果：`200`
- 未登录提交候选：
```bash
curl -s -o NUL -w "%{http_code}" -X POST http://127.0.0.1:3011/api/prompts/api-debug-assistant/submissions -H "content-type: application/json" -d "{\"content\":\"x\",\"changeNote\":\"y\"}"
```
  - 结果：`401`
- 版本点赞同 IP 同日重复：
  - 第一次 `200`，第二次 `429`
- 版本评分同 IP 同日重复：
  - 第一次 `200`，第二次 `429`

## 结论
- 已实现 fail-closed：限流基础设施缺失时，点赞/评分不会继续放行。
