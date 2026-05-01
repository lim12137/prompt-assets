# 2026-05-01 前端管理页与首页分类器测试报告

## 范围

- 后台提示词管理页 `/admin/prompts`
- 后台提示词管理详情页 `/admin/prompts/[slug]`
- 首页分类器单选切换行为

## 执行命令

```bash
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --reporter=line
pnpm exec playwright test tests/e2e/smoke/home.spec.ts --grep "分类支持单选切换与再次点击取消" --reporter=line
```

## 结果摘要

1. `tests/e2e/admin/prompts-management.spec.ts`
   - 结果：2 passed
   - 覆盖：
     - 管理列表归档
     - 管理列表恢复发布
     - 管理详情重新分类
     - `uncategorized` 在补正式分类后自动移除
     - 删除预检查与确认删除

2. `tests/e2e/smoke/home.spec.ts --grep "分类支持单选切换与再次点击取消"`
   - 结果：1 passed
   - 覆盖：
     - 默认无筛选
     - 点击单个分类选中
     - 点击其他分类切换
     - 点击当前分类取消

## 环境处理说明

- Playwright 复测改为串行执行，避免同时拉起两套 Next dev web server 导致内存耗尽。
- 为 `apps/web/scripts/run-next.mjs` 增加默认 `NODE_OPTIONS=--max-old-space-size=4096`，解决当前环境下 Next dev 的 OOM 问题。
