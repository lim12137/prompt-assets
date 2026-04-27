# 评分查询契约

基线日期：2026-04-27  
来源实现：
- `apps/web/app/api/prompts/[slug]/route.ts`
- `apps/web/lib/api/prompt-mappers.ts`
- `tests/integration/api/prompt-detail.test.ts`

## 1. `GET /api/prompts/{slug}`

- 说明：查询 Prompt 详情，返回 Prompt 总点赞与版本级点赞。
- Path 参数：
  - `slug`：必填，去空格后不能为空。

### 1.1 成功响应 `200`

```json
{
  "slug": "ux-research-plan",
  "title": "UX 研究计划器",
  "summary": "快速生成访谈与可用性测试计划。",
  "likesCount": 12,
  "updatedAt": "2026-04-27T00:00:00.000Z",
  "categories": [{ "slug": "design", "name": "设计" }],
  "categorySlugs": ["design"],
  "category": { "slug": "design", "name": "设计" },
  "currentVersion": {
    "versionNo": "v0003",
    "sourceType": "submission",
    "submittedAt": "2026-04-27T00:00:00.000Z",
    "likesCount": 7,
    "liked": false,
    "content": "..."
  },
  "versions": [
    {
      "versionNo": "v0003",
      "sourceType": "submission",
      "status": "pending",
      "submittedAt": "2026-04-27T00:00:00.000Z",
      "submittedBy": "alice@example.com",
      "likesCount": 7,
      "liked": false,
      "content": "..."
    }
  ]
}
```

### 1.2 失败响应

- `400`：`{ "error": "invalid slug" }`
- `404`：`{ "error": "prompt not found" }`

## 2. 查询约束

- `likesCount` 字段类型固定为 number（Prompt 级与版本级）。
- `versions[].status === "rejected"` 时，不返回该版本 `content`。
- `currentVersion` 必须来自当前 Prompt 的版本集合；若数据漂移，后端会回退到可用版本，避免返回跨 Prompt 的当前版本。
