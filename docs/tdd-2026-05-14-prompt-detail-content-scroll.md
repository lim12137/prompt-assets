# TDD 报告：详情页卡片内容区最大高度与滚动

日期：2026-05-14  
任务：`/prompts/project-management` 页面卡片中的提示词内容展示区增加最大高度限制，并通过滚动条处理超长内容。

## RED（先失败）

命令：

```bash
pnpm exec playwright test tests/e2e/smoke/prompt-detail-content-scroll.spec.ts
```

结果摘要：
- 1 failed
- 失败点：`maxHeight` 实际为 `none`，未满足“存在最大高度限制”的预期。

## GREEN（最小实现后通过）

实现变更：
- `apps/web/app/globals.css`
  - 在 `.pm-code-block` 增加 `max-height: 420px;`
  - 在 `.pm-code-block` 增加 `overflow-y: auto;`

命令：

```bash
pnpm exec playwright test tests/e2e/smoke/prompt-detail-content-scroll.spec.ts
```

结果摘要：
- 1 passed
- 新增断言通过：内容块具备最大高度且支持纵向滚动。

## 验证补充

命令：

```bash
pnpm exec playwright test tests/e2e/smoke/prompt-detail-like.spec.ts
pnpm exec playwright test tests/e2e/smoke/prompt-detail-ux-candidate-like.spec.ts
```

结果摘要：
- 两个用例均失败，失败现象分别为：
  - `prompt-detail-like.spec.ts`：`official-card` 未找到。
  - `prompt-detail-ux-candidate-like.spec.ts`：点赞接口返回 `404`（预期 `401`）。
- 失败均表现为环境/数据链路问题，未指向本次纯样式改动逻辑。
