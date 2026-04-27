# UX 候选版本点赞链路修复 QA 报告（2026-04-27）

## 范围
- 链路：`/prompts/ux-research-plan` 页面候选卡 `v0003` 点赞
- API：`POST /api/prompts/ux-research-plan/versions/v0003/like`
- 一致性：`currentVersion` 必须来自当前 prompt 的版本集合

## 根因分析
- `currentVersion` 脏引用：详情映射阶段直接信任 `raw.currentVersionNo/currentVersionContent`，当 `current_version_id` 发生跨 prompt 脏引用时，会把不属于当前 prompt 的版本号/内容带入响应。
- 候选版本点赞 404：`ux-research-plan` 在 fixture 基线下缺少 `v0003` 及对应 pending submission，导致 `POST /api/prompts/ux-research-plan/versions/v0003/like` 无法命中目标版本并返回 404。
- 额外防护：DB 查询对 `current_version_id` 关联增加 `cv.prompt_id = p.id`，避免把其他 prompt 的版本 join 成当前版本。

## TDD 过程
### RED（先失败）
命令：
```bash
node --test --experimental-strip-types tests/integration/api/prompt-detail-current-version-consistency.test.ts tests/integration/api/prompt-version-like.test.ts
```
结果摘要：
- `mapPromptDetail: currentVersion 必须属于当前 prompt 的 versions 集合` 失败  
  断言：`'v9999' !== 'v0002'`
- `POST /api/prompts/ux-research-plan/versions/v0003/like 候选版本可点赞` 失败  
  断言：`404 !== 200`

### GREEN（最小修复后通过）
命令：
```bash
node --test --experimental-strip-types tests/integration/api/prompt-detail-current-version-consistency.test.ts tests/integration/api/prompt-version-like.test.ts
```
结果摘要：
- 7/7 通过（0 失败）

## 回归与相关 QA
命令：
```bash
node --test --experimental-strip-types tests/integration/api/prompt-detail-current-version-consistency.test.ts tests/integration/api/prompt-version-like.test.ts tests/integration/api/prompt-detail-candidate-cards.test.ts
```
结果摘要：
- 8/8 通过（0 失败）

命令：
```bash
pnpm exec playwright test tests/e2e/smoke/prompt-detail-ux-candidate-like.spec.ts
```
结果摘要：
- 1/1 通过（页面上点击候选卡 `v0003` 触发 `POST .../v0003/like` 返回 200，点赞数 +1）

命令：
```bash
pnpm exec playwright test tests/e2e/smoke/prompt-detail-like.spec.ts tests/e2e/smoke/prompt-detail-candidate-flow.spec.ts
```
结果摘要：
- 2/2 通过（相关详情点赞/候选流程无回归）

## 结论
- `currentVersion` 脏引用防护已生效，不再返回跨 prompt 的版本号/内容。
- `ux-research-plan@v0003` 候选版本点赞链路页面/API 均通过回归。
