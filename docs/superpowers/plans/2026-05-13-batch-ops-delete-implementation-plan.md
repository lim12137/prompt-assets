# Batch Ops Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有提示词管理列表页上补齐全选、反选、批量删除提示词，并将现有批量分类能力统一到同一批量操作浮层中。

**Architecture:** 继续复用当前 admin prompts 列表、固定底部浮层和批量分类接口。新增列表侧的全选/反选 UI 和批量删除提示词后端接口；删除走“预检查 + 确认 token”双阶段模型，分类保持平级多分类。批量操作成功后只重新收敛当前列表数据，不整页 reload，不跳路由。

**Tech Stack:** Next.js App Router, React, Playwright E2E, 现有 admin prompts API/repository, PostgreSQL.

---

### Task 1: 补齐列表页全选 / 反选交互

**Files:**
- Modify: `apps/web/app/admin/prompts/_prompt-management-console.jsx`
- Test: `tests/e2e/admin/prompts-management.spec.ts`

- [ ] **Step 1: 写失败测试**

```ts
test('后台提示词管理列表支持全选和反选', async ({ page }) => {
  await page.goto('/admin/prompts');
  await page.getByRole('button', { name: '全选' }).click();
  await expect(page.getByText('已选 3 项')).toBeVisible();
  await page.getByRole('button', { name: '反选' }).click();
  await expect(page.getByText('已选 0 项')).toBeVisible();
});
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "全选和反选"`
Expected: FAIL，因为列表页还没有全选/反选入口。

- [ ] **Step 3: 最小实现**

```jsx
// 在筛选区右侧增加：
// - 全选：选择当前筛选结果集里所有可见 prompt slug
// - 反选：对当前可见结果集做差集切换
// 只影响当前页已有列表数据，不新增跨页语义
```

- [ ] **Step 4: 跑测试确认绿灯**

Run: `pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "全选和反选"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/app/admin/prompts/_prompt-management-console.jsx tests/e2e/admin/prompts-management.spec.ts
git commit -m "feat: add select-all and invert-selection for prompt list"
```

### Task 2: 新增批量删除提示词后端接口

**Files:**
- Create: `apps/web/app/api/admin/prompts/batch-delete/route.ts`
- Modify: `apps/web/lib/api/prompt-repository.ts`
- Test: `tests/integration/api/admin-prompts-management.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
test('PATCH /api/admin/prompts/batch-delete supports dry-run and confirm delete', async () => {
  // 先请求 dry-run，拿到 confirmationToken
  // 再带 token 请求 confirm delete
  // 断言多条提示词被删除
});
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `pnpm -s node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts --test-name-pattern "batch-delete"`
Expected: FAIL，因为接口不存在。

- [ ] **Step 3: 最小实现**

```ts
// route 语义：
// { slugs: string[], dryRun?: boolean, confirmationToken?: string, confirm?: boolean }
// dryRun -> 返回影响摘要 + confirmationToken
// confirm -> 校验 token 后执行批量删除
```

- [ ] **Step 4: 跑测试确认绿灯**

Run: `pnpm -s node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts --test-name-pattern "batch-delete"`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/app/api/admin/prompts/batch-delete/route.ts apps/web/lib/api/prompt-repository.ts tests/integration/api/admin-prompts-management.test.ts
git commit -m "feat: add batch delete api for prompts"
```

### Task 3: 把批量删除提示词接入固定底部浮层

**Files:**
- Modify: `apps/web/app/admin/prompts/_prompt-management-console.jsx`
- Modify: `apps/web/app/globals.css`
- Test: `tests/e2e/admin/prompts-management.spec.ts`
- Test: `tests/e2e/admin/prompts-management-real-db.spec.ts`

- [ ] **Step 1: 写失败测试**

```ts
test('后台提示词管理列表支持批量删除提示词', async ({ page }) => {
  await page.goto('/admin/prompts');
  await page.getByLabel('选择提示词').nth(0).check();
  await page.getByLabel('选择提示词').nth(1).check();
  await page.getByRole('button', { name: '批量删除提示词' }).click();
  await expect(page.getByText('删除的是提示词本体')).toBeVisible();
  await page.getByRole('button', { name: '确认删除 2 项' }).click();
  await expect(page.getByText('已删除 2 项提示词')).toBeVisible();
});
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "批量删除提示词"`
Expected: FAIL，因为列表浮层还没有删除确认流。

- [ ] **Step 3: 最小实现**

```jsx
// 浮层新增删除模式：
// - 先点击“批量删除提示词”
// - 展开风险说明和影响摘要
// - 先调 dry-run 拿 token
// - 再点击确认删除，调 confirm delete
// - 成功后按当前 filters 重新收敛列表，清空选择
```

- [ ] **Step 4: 跑测试确认绿灯**

Run:
```bash
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "批量删除提示词"
pnpm run test:e2e:admin:prompts:db
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add apps/web/app/admin/prompts/_prompt-management-console.jsx apps/web/app/globals.css tests/e2e/admin/prompts-management.spec.ts tests/e2e/admin/prompts-management-real-db.spec.ts
git commit -m "feat: add bulk delete flow to prompt list"
```

### Task 4: 补齐筛选收敛与危险场景验证

**Files:**
- Modify: `tests/e2e/admin/prompts-management.spec.ts`
- Modify: `tests/e2e/admin/prompts-management-real-db.spec.ts`

- [ ] **Step 1: 写失败测试**

```ts
test('批量删除后当前筛选结果集会重新收敛', async ({ page }) => {
  // 在分类筛选或关键词筛选下选中多条
  // 删除后断言当前列表结果集重新收敛，不保留已删卡片
});
```

- [ ] **Step 2: 跑测试确认红灯**

Run: `pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "重新收敛"`
Expected: FAIL，如果当前删除成功后列表未正确收敛。

- [ ] **Step 3: 最小实现或测试修正**

```ts
// 若实现已支持，只补测试
// 若有缺口，仅最小修复当前列表收敛逻辑
```

- [ ] **Step 4: 跑测试确认绿灯**

Run:
```bash
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts --grep "重新收敛"
pnpm run test:e2e:admin:prompts:db
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add tests/e2e/admin/prompts-management.spec.ts tests/e2e/admin/prompts-management-real-db.spec.ts
git commit -m "test: cover bulk delete list convergence"
```

### Task 5: 文档与最终验收

**Files:**
- Create: `docs/2026-05-13-batch-ops-delete-final-report.md`

- [ ] **Step 1: 写验收报告**

```md
- 功能范围
- 关键交互
- 执行命令
- 结果摘要
- 已知风险
```

- [ ] **Step 2: 跑最终验收命令**

Run:
```bash
pnpm exec playwright test tests/e2e/admin/prompts-management.spec.ts
pnpm run test:e2e:admin:prompts:db
pnpm -s node --test --experimental-strip-types tests/integration/api/admin-prompts-management.test.ts --test-name-pattern "batch-delete"
```
Expected: all pass

- [ ] **Step 3: 提交**

```bash
git add docs/2026-05-13-batch-ops-delete-final-report.md
git commit -m "docs: record batch ops delete acceptance"
```

---

### Coverage Check

- 列表页全选/反选：Task 1
- 批量删除提示词：Task 2 + Task 3
- 批量分类与删除统一浮层：Task 3
- 筛选结果收敛：Task 4
- 最终验收与文档：Task 5
