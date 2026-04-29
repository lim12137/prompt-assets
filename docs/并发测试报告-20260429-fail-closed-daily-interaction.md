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
- 在 `55433` 测试库复现到 RED：两条 fail-closed 用例断言失败，实际返回 `200`（预期 `500`）。

## 实现修改
- `apps/web/lib/api/prompt-repository.ts`
  - `markPromptVersionDailyInteraction` 在非 fixture 且 DB 可连通时，强制走 DB 路径检查基础设施，避免缺表时错误回落 fixture。
  - 新增 `getRuntimeDatabaseUrl()`，日频交互链路按请求时环境变量读取 `DATABASE_URL`，避免模块加载时静态 URL 导致“改了 55433、却查了旧库”。
- `tests/integration/api/prompt-version-like.test.ts`
  - fail-closed 用例加入 `pg_advisory_lock` 串行保护，避免与其它并发测试对同一表重命名/恢复产生竞态。
- `tests/integration/api/prompt-version-score.test.ts`
  - 同上，使用同一 advisory lock key 串行化关键区间。

## GREEN（相关测试）
- 命令：
```bash
TEST_DB_PORT=55433
TEST_DATABASE_URL=postgres://postgres:postgres@127.0.0.1:55433/prompt_management_test
node --test --experimental-strip-types tests/unit/auth/request-ip.test.ts tests/integration/api/prompt-version-like.test.ts tests/integration/api/prompt-version-score.test.ts tests/integration/api/prompt-submission.test.ts
```
- 结果摘要：
  - `pass=32`
  - `skip=0`
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
- 已实现 fail-closed：当 `prompt_version_daily_interactions` 缺失（或缺必要列）时，点赞/评分返回 `500 + missing_infrastructure`，不再返回 `200`。
