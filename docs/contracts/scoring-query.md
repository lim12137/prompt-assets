# 评分查询契约

基线日期：2026-04-27  
来源实现：
- `apps/web/app/api/prompts/[slug]/versions/[versionNo]/score-stats/route.ts`
- `apps/web/lib/api/prompt-repository.ts`（`getPromptVersionScoreStats`）
- `tests/integration/api/prompt-version-score.test.ts`

## 1. `GET /api/prompts/{slug}/versions/{versionNo}/score-stats`

- 说明：查询某个 Prompt 版本的评分统计。
- Path 参数：
  - `slug`：必填。
  - `versionNo`：必填。
- Query 参数：
  - `scene`：可选；传入后只统计对应场景。

### 1.1 成功响应 `200`

```json
{
  "slug": "ux-research-plan",
  "versionNo": "v0003",
  "scene": "detail_page",
  "totalScores": 4,
  "averageScore": 3,
  "lowScoreRate": 0.5,
  "distribution": {
    "1": 1,
    "2": 1,
    "3": 0,
    "4": 1,
    "5": 1
  }
}
```

### 1.2 失败响应

- `400`：`invalid slug` / `invalid versionNo` / `invalid scene`
- `404`：`{ "error": "prompt version not found" }`

## 2. 查询约束

- 当某版本尚无评分时，`totalScores=0`，`averageScore=0`，`lowScoreRate=0`，`distribution` 全部为 `0`。
- `scene` 未传：统计该版本所有场景。
- `scene` 已传：仅统计该场景。
