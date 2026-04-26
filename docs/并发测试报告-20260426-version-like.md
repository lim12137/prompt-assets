# 并发测试报告 - 2026-04-26 - version like

## 变更范围

- `tests/integration/db/schema.test.ts`
- `tests/integration/api/prompt-version-like.test.ts`
- `tests/integration/api/prompt-detail.test.ts`

## 测试目标

- 为版本级点赞能力补齐失败测试，覆盖迁移结构、接口行为、详情 DTO。
- 保持 TDD 红灯阶段，不修改业务实现文件。

## 建议执行命令

```powershell
node --test --experimental-strip-types tests/integration/db/schema.test.ts tests/integration/api/prompt-detail.test.ts tests/integration/api/prompt-version-like.test.ts
```

## 当前结果摘要

- 当前为预期中的失败态。
- `schema.test.ts` 将要求迁移新增 `prompt_version_likes` 表、`prompt_version_likes(prompt_version_id, user_id)` 唯一约束，以及 `prompt_versions.likes_count` 字段。
- `prompt-version-like.test.ts` 将要求新增版本级点赞路由 `apps/web/app/api/prompts/[slug]/versions/[versionNo]/like/route.ts`，并满足首次点赞、重复幂等、取消回退、版本隔离、缺失 `versionNo` 返回 `404`。
- `prompt-detail.test.ts` 将要求详情 DTO 的 `currentVersion.likesCount` 和 `versions[].likesCount` 可用。

## 实测记录

已执行命令：

```powershell
node --test --experimental-strip-types tests/integration/db/schema.test.ts tests/integration/api/prompt-detail.test.ts tests/integration/api/prompt-version-like.test.ts
```

结果摘要：

- 总计 `17` 项：`6` 通过，`7` 失败，`4` 跳过。
- `tests/integration/api/prompt-detail.test.ts`
  - `GET /api/prompts/[slug] 返回最小详情结构` 失败。
  - 失败原因：`payload.currentVersion.likesCount` 当前为 `undefined`，尚未暴露版本点赞计数。
- `tests/integration/api/prompt-version-like.test.ts`
  - 5 个版本级点赞场景全部失败。
  - 失败原因：缺少路由模块 `apps/web/app/api/prompts/[slug]/versions/[versionNo]/like/route.ts`。
- `tests/integration/db/schema.test.ts`
  - `静态断言: 版本级点赞表、唯一约束与版本计数字段已在迁移中定义` 失败。
  - 失败原因：迁移中尚未定义 `prompt_version_likes` 表，后续唯一约束与 `prompt_versions.likes_count` 断言也未满足。
- 真实 DB 断言均被跳过。
  - 跳过原因：测试库不可达 `postgres://postgres:postgres@127.0.0.1:55432/prompt_management_test`。
