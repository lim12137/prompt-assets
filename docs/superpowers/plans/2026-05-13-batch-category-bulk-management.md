# Batch Category Bulk Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-overhead bulk category workflow on the admin prompt list so operators can select imported cards, add/remove multiple flat categories, and keep the UI aligned with the no-primary-category model.

**Architecture:** Extend the existing admin prompt list with local selection state and a floating action bar. Add one batch backend mutation that accepts multiple slugs plus add/remove category lists, updates the prompt-category join table in one transaction, and returns refreshed prompt metadata so the list can update without a full reload.

**Tech Stack:** Next.js App Router, React, existing admin prompt repository/API layer, existing prompt-category join table, Playwright/e2e tests, integration API tests.

---

### Task 1: Lock the batch mutation contract

**Files:**
- Modify: `apps/web/app/api/admin/prompts/[slug]/route.ts`
- Create: `apps/web/app/api/admin/prompts/batch-categories/route.ts`
- Modify: `apps/web/lib/api/prompt-repository.ts`
- Modify: `apps/web/lib/api/prompt-mappers.ts`
- Test: `tests/integration/api/admin-prompts-management.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('bulk category update adds and removes categories for multiple prompts', async () => {
  // create two prompts and two categories
  // call the new batch endpoint with slugs, addCategorySlugs, removeCategorySlugs
  // expect both prompts to end up with the same flat category set
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/integration/api/admin-prompts-management.test.ts -v`
Expected: FAIL because the batch endpoint does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
// batch-categories route accepts:
// { slugs: string[], addCategorySlugs: string[], removeCategorySlugs: string[] }
// It updates prompt_categories in one transaction and returns updated prompt summaries.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/integration/api/admin-prompts-management.test.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/api/admin/prompts/batch-categories/route.ts apps/web/lib/api/prompt-repository.ts apps/web/lib/api/prompt-mappers.ts apps/web/app/api/admin/prompts/[slug]/route.ts tests/integration/api/admin-prompts-management.test.ts
git commit -m "feat: add bulk category mutation"
```

### Task 2: Add list-page selection and floating bulk bar

**Files:**
- Modify: `apps/web/app/admin/prompts/_prompt-management-console.jsx`
- Modify: `apps/web/app/admin/prompts/_prompt-management-console.module.css` or related style file if present
- Test: `tests/e2e/admin/prompts-management.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('admin prompt list shows bulk bar after selecting prompts', async ({ page }) => {
  await page.goto('/admin/prompts');
  await page.getByLabel('Select prompt').first().check();
  await expect(page.getByRole('toolbar', { name: 'Bulk actions' })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/e2e/admin/prompts-management.spec.ts -v`
Expected: FAIL because selection and bulk bar are missing.

- [ ] **Step 3: Write minimal implementation**

```jsx
// Add row checkboxes, selected count, and a sticky floating action bar.
// The bar exposes:
// - add categories
// - remove categories
// - clear selection
// Only local UI state changes are needed until mutation runs.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/e2e/admin/prompts-management.spec.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/prompts/_prompt-management-console.jsx tests/e2e/admin/prompts-management.spec.ts
git commit -m "feat: add prompt list bulk selection"
```

### Task 3: Wire add/remove category flows into the bulk bar

**Files:**
- Modify: `apps/web/app/admin/prompts/_prompt-management-console.jsx`
- Modify: `apps/web/lib/api/prompt-repository.ts`
- Test: `tests/e2e/admin/prompts-management-real-db.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('bulk bar can add and remove categories without reloading the page', async ({ page }) => {
  // select two prompts, add one category, remove one category
  // verify the visible category pills update locally after success
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/e2e/admin/prompts-management-real-db.spec.ts -v`
Expected: FAIL because bulk add/remove actions are not wired.

- [ ] **Step 3: Write minimal implementation**

```jsx
// Submit one batch request, then patch the visible rows from the API response.
// Keep the current page state intact; avoid a full list refetch unless the batch fails.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/e2e/admin/prompts-management-real-db.spec.ts -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/admin/prompts/_prompt-management-console.jsx apps/web/lib/api/prompt-repository.ts tests/e2e/admin/prompts-management-real-db.spec.ts
git commit -m "feat: wire bulk category actions"
```

### Task 4: Update docs and capture the workflow

**Files:**
- Create: `docs/2026-05-13-batch-category-bulk-management-report.md`

- [ ] **Step 1: Write the verification report**

```md
- what changed
- how to use bulk select + add/remove
- test commands
- result summary
```

- [ ] **Step 2: Run the verification commands**

Run:
```bash
pnpm test tests/integration/api/admin-prompts-management.test.ts -v
pnpm test tests/e2e/admin/prompts-management.spec.ts -v
pnpm test tests/e2e/admin/prompts-management-real-db.spec.ts -v
```
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add docs/2026-05-13-batch-category-bulk-management-report.md
git commit -m "docs: record batch category workflow"
```

---

### Coverage Check

- Batch add/remove categories for multiple imported cards: Task 1 + Task 3
- List-page floating action bar: Task 2
- No primary category model: preserved by using flat `categorySlugs` only
- Low overhead UI: selection state stays local; one batch mutation per action
- Tests and docs: Tasks 1-4

