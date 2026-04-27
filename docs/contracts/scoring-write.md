# 评分写入契约

基线日期：2026-04-27  
来源实现：
- `apps/web/app/api/prompts/[slug]/versions/[versionNo]/score/route.ts`
- `apps/web/lib/api/prompt-repository.ts`（`scorePromptVersion`）
- `tests/integration/api/prompt-version-score.test.ts`

## 1. `POST /api/prompts/{slug}/versions/{versionNo}/score`

- 说明：为指定 Prompt 版本写入 1-5 分评分。
- Header：
  - `x-user-email` 可选；缺失时后端默认 `alice@example.com`。
- Path 参数：
  - `slug`：必填，去空格后不能为空。
  - `versionNo`：必填，示例 `v0003`。
- Body：

```json
{
  "scene": "detail_page",
  "traceId": "trace-20260427-001",
  "score": 4
}
```

- 字段约束：
  - `scene`：必填，非空字符串。
  - `traceId`：可选；若不传，后端自动生成。
  - `score`：必填，整数且范围 `1..5`。

### 1.1 成功响应 `200`

```json
{
  "slug": "ux-research-plan",
  "versionNo": "v0003",
  "scene": "detail_page",
  "traceId": "trace-20260427-001",
  "score": 4
}
```

### 1.2 失败响应

- `400`：
  - `{ "error": "invalid slug" }`
  - `{ "error": "invalid versionNo" }`
  - `{ "error": "invalid user email" }`
  - `{ "error": "scene is required" }`
  - `{ "error": "score must be an integer between 1 and 5" }`
- `404`：`{ "error": "prompt version not found" }`

## 2. 持久化约束

- 表：`prompt_version_scores`。
- 核心字段：`prompt_version_id`、`user_id`、`scene`、`trace_id`、`score`。
- 约束：
  - `score` 检查约束：`1 <= score <= 5`。
  - 唯一约束：`(prompt_version_id, scene, trace_id)`。
