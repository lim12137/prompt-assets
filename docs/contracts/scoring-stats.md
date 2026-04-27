# 评分统计契约

基线日期：2026-04-27  
来源实现：
- `apps/web/app/api/prompts/[slug]/versions/[versionNo]/score-stats/route.ts`
- `apps/web/lib/api/prompt-repository.ts`（评分聚合逻辑）
- `tests/integration/api/prompt-version-score.test.ts`

## 1. 指标定义

- `totalScores`：当前统计范围内评分条数。
- `averageScore`：平均分，保留至最多 4 位小数；无数据时为 `0`。
- `distribution`：1-5 各分值计数。
- `lowScoreRate`：低分率，定义为 `(score <= 2) / totalScores`；无数据时为 `0`。

## 2. 过滤口径

- 不传 `scene`：聚合该版本全部评分。
- 传 `scene=<value>`：只聚合该场景评分。

## 3. 一致性约束

- 写入 `POST /score` 成功后，后续读取 `GET /score-stats` 可见。
- 同一 `(prompt_version_id, scene, trace_id)` 视为同一采样键，重复写入走 upsert，不会新增重复采样点。
