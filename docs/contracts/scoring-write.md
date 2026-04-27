# 评分写入契约

基线日期：2026-04-27  
来源实现：
- `apps/web/app/api/prompts/[slug]/like/route.ts`
- `apps/web/app/api/prompts/[slug]/versions/[versionNo]/like/route.ts`
- `tests/integration/api/prompt-like.test.ts`
- `tests/integration/api/prompt-version-like.test.ts`

## 1. 点赞/取消点赞（Prompt 维度）

### 1.1 `POST /api/prompts/{slug}/like`
- 说明：对 Prompt 进行点赞，幂等。
- Header：
  - `x-user-email` 可选；缺失时后端默认 `alice@example.com`。
- Path 参数：
  - `slug`：必填，去空格后不能为空。
- 成功响应 `200`：

```json
{
  "slug": "api-debug-assistant",
  "likesCount": 3,
  "liked": true
}
```

- 失败响应：
  - `400`：`{ "error": "invalid slug" }` 或 `{ "error": "invalid user email" }`
  - `404`：`{ "error": "prompt not found" }`

### 1.2 `DELETE /api/prompts/{slug}/like`
- 说明：取消点赞，幂等。
- Header / Path 参数与 `POST` 相同。
- 成功响应 `200`：

```json
{
  "slug": "api-debug-assistant",
  "likesCount": 2,
  "liked": false
}
```

## 2. 点赞/取消点赞（版本维度）

### 2.1 `POST /api/prompts/{slug}/versions/{versionNo}/like`
- 说明：对指定版本点赞，幂等。
- Header：
  - `x-user-email` 可选；缺失时后端默认 `alice@example.com`。
- Path 参数：
  - `slug`：必填。
  - `versionNo`：必填（示例 `v0003`）。
- 成功响应 `200`：

```json
{
  "slug": "ux-research-plan",
  "versionNo": "v0003",
  "likesCount": 7,
  "liked": true
}
```

- 失败响应：
  - `400`：`invalid slug` / `invalid versionNo` / `invalid user email`
  - `404`：`{ "error": "prompt version not found" }`

### 2.2 `DELETE /api/prompts/{slug}/versions/{versionNo}/like`
- 说明：取消版本点赞，幂等。
- Header / Path 参数与 `POST` 相同。
- 成功响应 `200`：

```json
{
  "slug": "ux-research-plan",
  "versionNo": "v0003",
  "likesCount": 6,
  "liked": false
}
```

## 3. 行为约束

- 幂等：同一用户重复 `POST` 不重复加计数；重复 `DELETE` 不会继续减计数。
- 计数下界：计数不会出现负数。
- 一致性：写入后查询详情时，`likesCount` 会反映最新值（见 `prompt-like` / `prompt-version-like` 集成测试断言）。
