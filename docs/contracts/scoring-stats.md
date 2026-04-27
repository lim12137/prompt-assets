# 评分统计契约

基线日期：2026-04-27  
来源实现：
- `apps/web/app/api/prompts/route.ts`
- `apps/web/lib/api/prompt-repository.ts`（`normalizeSort` 与列表排序逻辑）
- `tests/integration/api/prompts-list.test.ts`

## 1. `GET /api/prompts?sort=popular`

- 说明：返回 Prompt 列表，并按评分热度（`likesCount`）降序。
- Query 参数：
  - `sort`：支持 `popular` / `liked`，其余值按 `latest` 处理。
  - 可叠加 `category`、`categories`、`keyword` 过滤。

### 1.1 成功响应 `200`

```json
[
  {
    "slug": "api-debug-assistant",
    "title": "API 调试助手",
    "summary": "自动生成调试清单",
    "currentVersionContent": "...",
    "likesCount": 18,
    "updatedAt": "2026-04-27T00:00:00.000Z",
    "categorySlug": "programming",
    "categoryName": "编程",
    "categories": [{ "slug": "programming", "name": "编程" }],
    "categorySlugs": ["programming"]
  }
]
```

## 2. 统计口径约束

- 排序口径：
  - `sort=popular` 或 `sort=liked`：按 `likesCount` 降序。
  - 评分相同：按 `updatedAt`（新到旧）稳定排序。
  - 其他值或缺省：按 `latest`（更新时间降序）。
- 过滤口径：
  - `categories` 支持逗号分隔与多值，按 OR 语义匹配。
  - `categories=` 空值视为“不过滤”，与不传参数等价。

## 3. 与写入契约的关系

- 评分写入成功后，统计接口会在后续读取中体现最新 `likesCount` 排序。
- 该契约只定义当前“列表统计读模型”，不新增独立统计接口。
