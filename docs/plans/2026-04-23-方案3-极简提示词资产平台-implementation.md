# 方案3-极简提示词资产平台 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在一个全新仓库中，以最小可交付范围搭建“提示词资产平台”MVP，先打通浏览、详情、投稿、审核、部署主链路，再逐步补齐互动与验收。

**Architecture:** 采用单仓库、单前端服务、单 PostgreSQL 的极简架构。`Next.js` 同时承载前台页面与 Route Handlers API，`Drizzle` 管理数据模型和迁移，领域规则下沉到独立 `src/domain` 以便单元测试先行。部署阶段使用 `Docker Compose` 编排 `web + postgres`，并把并发测试与验收报告统一落盘到 `docs/*.md`。

**Tech Stack:** `Next.js 16 + React 19 + TypeScript + pnpm + Vitest + Playwright + Drizzle ORM + PostgreSQL 16 + Docker Compose + k6`

---

## 实施约定

- 包管理器固定为 `pnpm`
- 应用目录固定为 `apps/web`
- 数据模型与迁移目录固定为 `packages/db`
- 纯领域规则目录固定为 `packages/domain`
- 自动化测试目录固定为 `tests/unit`、`tests/integration`、`tests/e2e`、`tests/concurrency`
- 并发测试报告固定落盘到 `docs/并发测试报告-YYYYMMDD-场景名.md`
- 每个任务结束后立即运行最小回归，再提交一次小 commit

### Task 1: 锁定运行时与目录约定

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.nvmrc`
- Create: `.gitignore`
- Create: `apps/web/.gitkeep`
- Create: `packages/db/.gitkeep`
- Create: `packages/domain/.gitkeep`
- Create: `tests/unit/.gitkeep`
- Create: `tests/integration/.gitkeep`
- Create: `tests/e2e/.gitkeep`
- Create: `tests/concurrency/.gitkeep`

**Test Path:**
- `tests/unit/smoke/runtime.test.ts`

**Step 1: 创建工作区配置与目录骨架**

Run:

```bash
mkdir -p apps/web packages/db packages/domain tests/unit tests/integration tests/e2e tests/concurrency
pnpm init
```

Expected:
- 根目录出现 `package.json`
- 目录结构与本计划一致

**Step 2: 写第一个失败测试，锁定 Node 与 pnpm 版本**

Create `tests/unit/smoke/runtime.test.ts`，断言：
- Node 主版本为 `22`
- `package.json` 中存在 `packageManager`

Run:

```bash
pnpm exec vitest run tests/unit/smoke/runtime.test.ts
```

Expected:
- FAIL，提示 `vitest` 未安装或测试文件未被识别

**Step 3: 安装最小测试工具并补齐根配置**

Run:

```bash
pnpm add -D typescript vitest @types/node
```

同时补齐：
- `package.json`：`packageManager`、`scripts.test`
- `pnpm-workspace.yaml`：包含 `apps/*`、`packages/*`
- `.nvmrc`：`22`

**Step 4: 运行测试直到通过**

Run:

```bash
pnpm exec vitest run tests/unit/smoke/runtime.test.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add package.json pnpm-workspace.yaml .nvmrc .gitignore apps packages tests
git commit -m "chore: initialize workspace skeleton"
```

Expected:
- 生成第一个基础提交

### Task 2: 初始化 `Next.js` 应用与开发脚本

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/src/app/layout.tsx`
- Create: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/globals.css`
- Test: `tests/e2e/smoke/home.spec.ts`

**Step 1: 先写首页冒烟 E2E**

Create `tests/e2e/smoke/home.spec.ts`，断言：
- `/` 返回 `200`
- 页面上存在 `Prompt Library`

Run:

```bash
pnpm exec playwright test tests/e2e/smoke/home.spec.ts
```

Expected:
- FAIL，提示 Playwright 未安装或无可启动服务

**Step 2: 初始化 `apps/web`**

Run:

```bash
pnpm dlx create-next-app@latest apps/web --ts --eslint --app --src-dir --use-pnpm --import-alias "@/*" --no-tailwind
```

Expected:
- `apps/web` 生成基础应用

**Step 3: 安装 E2E 依赖与根脚本**

Run:

```bash
pnpm add -D @playwright/test start-server-and-test
pnpm --dir apps/web add next react react-dom
```

在根 `package.json` 增加：
- `dev:web`
- `test:e2e`

**Step 4: 让首页测试通过**

实现最小页面：
- `apps/web/src/app/page.tsx` 输出 `Prompt Library`

Run:

```bash
pnpm exec playwright test tests/e2e/smoke/home.spec.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add package.json apps/web tests/e2e
git commit -m "feat: bootstrap nextjs web app"
```

### Task 3: 先锁定环境变量与健康检查

**Files:**
- Create: `apps/web/src/env.ts`
- Create: `apps/web/src/app/api/health/route.ts`
- Test: `tests/unit/env/env.test.ts`
- Test: `tests/integration/api/health.test.ts`

**Step 1: 写环境变量失败测试**

Create `tests/unit/env/env.test.ts`，断言：
- 缺少 `DATABASE_URL` 时抛错
- 提供 `APP_BASE_URL` 时可正确解析

Run:

```bash
pnpm exec vitest run tests/unit/env/env.test.ts
```

Expected:
- FAIL，提示 `src/env.ts` 不存在

**Step 2: 写健康检查失败测试**

Create `tests/integration/api/health.test.ts`，断言：
- `GET /api/health` 返回 `200`
- 响应体包含 `status: "ok"`

Run:

```bash
pnpm exec vitest run tests/integration/api/health.test.ts
```

Expected:
- FAIL，提示路由不存在

**Step 3: 实现最小环境解析与健康接口**

实现：
- `apps/web/src/env.ts`
- `apps/web/src/app/api/health/route.ts`

要求：
- 使用纯函数导出 `getEnv()`
- 健康检查不连库，只验证进程与配置解析

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/unit/env/env.test.ts tests/integration/api/health.test.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src tests/unit/env tests/integration/api
git commit -m "feat: add env parsing and health endpoint"
```

### Task 4: 先写领域规则测试，锁定版本号与审核状态机

**Files:**
- Create: `packages/domain/src/versioning.ts`
- Create: `packages/domain/src/review-flow.ts`
- Create: `packages/domain/src/index.ts`
- Test: `tests/unit/domain/versioning.test.ts`
- Test: `tests/unit/domain/review-flow.test.ts`

**Step 1: 写版本号失败测试**

Create `tests/unit/domain/versioning.test.ts`，断言：
- 新 Prompt 第一版为 `v0001`
- 基于 `v0009` 生成下一版为 `v0010`

Run:

```bash
pnpm exec vitest run tests/unit/domain/versioning.test.ts
```

Expected:
- FAIL

**Step 2: 写审核流失败测试**

Create `tests/unit/domain/review-flow.test.ts`，断言：
- `pending -> approved` 合法
- `pending -> rejected` 合法
- `approved -> pending` 非法

Run:

```bash
pnpm exec vitest run tests/unit/domain/review-flow.test.ts
```

Expected:
- FAIL

**Step 3: 实现最小领域函数**

实现：
- `nextVersionNo()`
- `assertReviewTransition()`

要求：
- 不依赖数据库
- 仅承载纯业务规则

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/unit/domain/versioning.test.ts tests/unit/domain/review-flow.test.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add packages/domain tests/unit/domain
git commit -m "feat: add versioning and review domain rules"
```

### Task 5: 建立数据库 schema 与首个迁移

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`
- Create: `packages/db/migrations/0001_init.sql`
- Test: `tests/integration/db/schema.test.ts`

**Step 1: 写 schema 失败测试**

Create `tests/integration/db/schema.test.ts`，断言以下表存在：
- `users`
- `categories`
- `prompts`
- `prompt_versions`
- `prompt_likes`
- `audit_logs`

Run:

```bash
pnpm exec vitest run tests/integration/db/schema.test.ts
```

Expected:
- FAIL，提示数据库或 schema 不存在

**Step 2: 定义 schema**

在 `packages/db/src/schema.ts` 建立最小字段：
- `users(id, email, role, created_at)`
- `categories(id, name, slug, sort_order, status)`
- `prompts(id, slug, title, summary, category_id, current_version_id, likes_count, status, created_at, updated_at)`
- `prompt_versions(id, prompt_id, version_no, content, change_note, source_type, review_status, submitted_by, reviewed_by, submitted_at, reviewed_at)`
- `prompt_likes(id, prompt_id, user_id, created_at)`，加唯一索引 `(prompt_id, user_id)`
- `audit_logs(id, actor_id, action, target_type, target_id, payload_json, created_at)`

**Step 3: 生成并整理首个迁移**

Run:

```bash
pnpm --dir packages/db drizzle-kit generate
```

Expected:
- 生成初始 SQL
- 必要时整理为 `0001_init.sql`

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/integration/db/schema.test.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add packages/db tests/integration/db
git commit -m "feat: add initial database schema"
```

### Task 6: 建立种子数据与测试夹具

**Files:**
- Create: `packages/db/src/seed.ts`
- Create: `tests/fixtures/prompts.ts`
- Test: `tests/integration/db/seed.test.ts`

**Step 1: 写 seed 失败测试**

Create `tests/integration/db/seed.test.ts`，断言：
- 至少插入 `3` 个分类
- 至少插入 `10` 条 Prompt
- 至少 `2` 条 `pending` 版本

Run:

```bash
pnpm exec vitest run tests/integration/db/seed.test.ts
```

Expected:
- FAIL

**Step 2: 实现最小 seed**

实现：
- 分类：内容创作、编程、设计
- 每类至少 3 条 Prompt
- 部分 Prompt 带多版本和待审核版本

**Step 3: 提供测试复用夹具**

在 `tests/fixtures/prompts.ts` 导出：
- `baseCategories`
- `promptCatalog`
- `pendingSubmissionFixture`

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/integration/db/seed.test.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add packages/db/src/seed.ts tests/fixtures tests/integration/db/seed.test.ts
git commit -m "test: add seed data fixtures"
```

### Task 7: 先定义 Prompt 列表与详情 API 合同

**Files:**
- Create: `tests/integration/api/prompts-list.test.ts`
- Create: `tests/integration/api/prompt-detail.test.ts`
- Create: `apps/web/src/lib/api/prompt-mappers.ts`
- Create: `apps/web/src/app/api/prompts/route.ts`
- Create: `apps/web/src/app/api/prompts/[slug]/route.ts`

**Step 1: 写列表接口失败测试**

断言：
- `GET /api/prompts` 默认返回卡片数组
- 支持 `category`、`keyword`、`sort`
- 每条记录至少包含 `slug`、`title`、`summary`、`likesCount`、`updatedAt`

Run:

```bash
pnpm exec vitest run tests/integration/api/prompts-list.test.ts
```

Expected:
- FAIL

**Step 2: 写详情接口失败测试**

断言：
- `GET /api/prompts/[slug]` 返回标题、分类、当前版本、历史版本
- 不返回 `rejected` 版本正文给前台

Run:

```bash
pnpm exec vitest run tests/integration/api/prompt-detail.test.ts
```

Expected:
- FAIL

**Step 3: 实现最小 Route Handlers**

实现：
- 列表查询
- 详情查询
- DTO 映射函数 `prompt-mappers.ts`

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/integration/api/prompts-list.test.ts tests/integration/api/prompt-detail.test.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src/app/api apps/web/src/lib/api tests/integration/api
git commit -m "feat: add prompt list and detail api contracts"
```

### Task 8: 搭首页页面骨架，先让结构测试失败

**Files:**
- Create: `apps/web/src/components/layout/app-shell.tsx`
- Create: `apps/web/src/components/prompt/category-nav.tsx`
- Create: `apps/web/src/components/prompt/search-bar.tsx`
- Create: `apps/web/src/components/prompt/prompt-card.tsx`
- Test: `tests/e2e/home/home-layout.spec.ts`

**Step 1: 写首页结构失败测试**

断言首页存在：
- 左侧分类导航
- 顶部搜索框
- 卡片网格区域
- 右上角 `导入`、`管理`、`创建`

Run:

```bash
pnpm exec playwright test tests/e2e/home/home-layout.spec.ts
```

Expected:
- FAIL

**Step 2: 实现静态布局骨架**

要求：
- 页面先用静态假数据
- 保持深色背景
- 中文文案与文档一致

**Step 3: 接通列表 API 的最小读取**

在首页服务端读取 `/api/prompts` 或直接调用查询层，渲染真实卡片列表。

**Step 4: 回归**

Run:

```bash
pnpm exec playwright test tests/e2e/home/home-layout.spec.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src/components apps/web/src/app/page.tsx tests/e2e/home
git commit -m "feat: add home page skeleton"
```

### Task 9: 实现首页分类与搜索联动

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Modify: `apps/web/src/components/prompt/category-nav.tsx`
- Modify: `apps/web/src/components/prompt/search-bar.tsx`
- Test: `tests/e2e/home/home-filtering.spec.ts`

**Step 1: 写筛选联动失败测试**

断言：
- 点击分类后卡片列表刷新
- 输入关键词后只显示命中项
- 无结果时出现空状态与“清空搜索”

Run:

```bash
pnpm exec playwright test tests/e2e/home/home-filtering.spec.ts
```

Expected:
- FAIL

**Step 2: 用 URL Query 管理状态**

要求：
- 分类参数：`?category=slug`
- 搜索参数：`?keyword=text`
- 排序参数：`?sort=latest|popular|liked`

**Step 3: 最小实现空状态**

空状态至少包含：
- 标题
- 说明
- 清空入口

**Step 4: 回归**

Run:

```bash
pnpm exec playwright test tests/e2e/home/home-filtering.spec.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src/app/page.tsx apps/web/src/components/prompt tests/e2e/home/home-filtering.spec.ts
git commit -m "feat: add category and search filtering"
```

### Task 10: 搭 Prompt 详情与版本历史骨架

**Files:**
- Create: `apps/web/src/app/prompts/[slug]/page.tsx`
- Create: `apps/web/src/components/prompt/prompt-detail.tsx`
- Create: `apps/web/src/components/prompt/version-history.tsx`
- Test: `tests/e2e/detail/prompt-detail.spec.ts`

**Step 1: 写详情页失败测试**

断言：
- 标题、分类、摘要可见
- 当前版本正文可见
- 版本历史区域可见
- 当前版本有明显标识

Run:

```bash
pnpm exec playwright test tests/e2e/detail/prompt-detail.spec.ts
```

Expected:
- FAIL

**Step 2: 实现详情页最小骨架**

要求：
- 首屏展示当前版本
- 侧边或下方展示历史列表
- 历史列表默认倒序

**Step 3: 接通详情 API**

对齐 Task 7 的响应字段，不新增前台专用接口。

**Step 4: 回归**

Run:

```bash
pnpm exec playwright test tests/e2e/detail/prompt-detail.spec.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src/app/prompts apps/web/src/components/prompt tests/e2e/detail
git commit -m "feat: add prompt detail and version history skeleton"
```

### Task 11: 先写复制与点赞行为测试

**Files:**
- Create: `apps/web/src/app/api/prompts/[slug]/like/route.ts`
- Create: `apps/web/src/components/prompt/prompt-actions.tsx`
- Test: `tests/integration/api/prompt-like.test.ts`
- Test: `tests/e2e/detail/prompt-actions.spec.ts`

**Step 1: 写点赞接口失败测试**

断言：
- 首次点赞计数加一
- 重复点赞不重复计数
- 取消点赞后计数回退

Run:

```bash
pnpm exec vitest run tests/integration/api/prompt-like.test.ts
```

Expected:
- FAIL

**Step 2: 写详情页操作失败测试**

断言：
- 点击“复制”后出现成功反馈
- 点赞按钮状态可切换

Run:

```bash
pnpm exec playwright test tests/e2e/detail/prompt-actions.spec.ts
```

Expected:
- FAIL

**Step 3: 实现最小复制与点赞**

要求：
- 复制使用浏览器 Clipboard API
- 点赞接口写 `prompt_likes`，同时更新 `prompts.likes_count`

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/integration/api/prompt-like.test.ts
pnpm exec playwright test tests/e2e/detail/prompt-actions.spec.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src/app/api/prompts apps/web/src/components/prompt tests/integration/api/prompt-like.test.ts tests/e2e/detail/prompt-actions.spec.ts
git commit -m "feat: add copy and like interactions"
```

### Task 12: 先写投稿接口测试，再补提交表单

**Files:**
- Create: `apps/web/src/app/api/prompts/[slug]/submissions/route.ts`
- Create: `apps/web/src/components/prompt/submission-form.tsx`
- Test: `tests/integration/api/prompt-submission.test.ts`
- Test: `tests/e2e/detail/prompt-submission.spec.ts`

**Step 1: 写投稿接口失败测试**

断言：
- 普通用户可基于当前版本提交新内容
- 新版本状态为 `pending`
- 当前生效版本不立即切换

Run:

```bash
pnpm exec vitest run tests/integration/api/prompt-submission.test.ts
```

Expected:
- FAIL

**Step 2: 写投稿表单失败测试**

断言：
- 表单初始值包含当前版本正文
- 提交后出现“已进入审核”

Run:

```bash
pnpm exec playwright test tests/e2e/detail/prompt-submission.spec.ts
```

Expected:
- FAIL

**Step 3: 实现最小投稿流**

要求：
- 字段包含 `content`、`changeNote`
- 服务端用 `nextVersionNo()` 生成版本号
- 写入 `audit_logs`

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/integration/api/prompt-submission.test.ts
pnpm exec playwright test tests/e2e/detail/prompt-submission.spec.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src/app/api/prompts apps/web/src/components/prompt/submission-form.tsx tests/integration/api/prompt-submission.test.ts tests/e2e/detail/prompt-submission.spec.ts
git commit -m "feat: add prompt submission flow"
```

### Task 13: 先写管理员审核测试，再补审核队列

**Files:**
- Create: `apps/web/src/app/admin/reviews/page.tsx`
- Create: `apps/web/src/app/api/admin/submissions/[id]/approve/route.ts`
- Create: `apps/web/src/app/api/admin/submissions/[id]/reject/route.ts`
- Create: `apps/web/src/components/admin/review-queue.tsx`
- Test: `tests/integration/api/admin-review.test.ts`
- Test: `tests/e2e/admin/review-queue.spec.ts`

**Step 1: 写审核接口失败测试**

断言：
- 只有 `admin` 可审核
- 审核通过后 `prompts.current_version_id` 更新
- 审核拒绝后记录拒绝原因

Run:

```bash
pnpm exec vitest run tests/integration/api/admin-review.test.ts
```

Expected:
- FAIL

**Step 2: 写审核队列失败测试**

断言：
- 管理页展示待审核列表
- 可点击“通过”或“拒绝”
- 成功后列表即时减少

Run:

```bash
pnpm exec playwright test tests/e2e/admin/review-queue.spec.ts
```

Expected:
- FAIL

**Step 3: 实现最小审核流**

要求：
- 通过时更新 `review_status`、`reviewed_by`、`reviewed_at`
- 通过时切换当前版本
- 拒绝时保留历史，不暴露到前台详情正文

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/integration/api/admin-review.test.ts
pnpm exec playwright test tests/e2e/admin/review-queue.spec.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add apps/web/src/app/admin apps/web/src/app/api/admin apps/web/src/components/admin tests/integration/api/admin-review.test.ts tests/e2e/admin/review-queue.spec.ts
git commit -m "feat: add admin review workflow"
```

### Task 14: 审计日志先测再补，保证关键动作留痕

**Files:**
- Create: `packages/domain/src/audit.ts`
- Create: `apps/web/src/lib/audit/write-audit-log.ts`
- Test: `tests/unit/domain/audit.test.ts`
- Test: `tests/integration/api/audit-log.test.ts`

**Step 1: 写审计规则失败测试**

断言以下动作会生成日志事件：
- 创建 Prompt
- 提交版本
- 审核通过
- 审核拒绝
- 点赞与取消点赞

Run:

```bash
pnpm exec vitest run tests/unit/domain/audit.test.ts tests/integration/api/audit-log.test.ts
```

Expected:
- FAIL

**Step 2: 实现审计事件构造器**

要求：
- 使用统一 `action` 枚举
- `payload_json` 仅写必要上下文

**Step 3: 将日志钩入已有主链路**

接入位置：
- 创建
- 投稿
- 审核
- 点赞

**Step 4: 回归**

Run:

```bash
pnpm exec vitest run tests/unit/domain/audit.test.ts tests/integration/api/audit-log.test.ts
```

Expected:
- PASS

**Step 5: 提交**

Run:

```bash
git add packages/domain apps/web/src/lib/audit tests/unit/domain/audit.test.ts tests/integration/api/audit-log.test.ts
git commit -m "feat: add audit logging"
```

### Task 15: 建立首页与审核页的最小视觉基线

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Create: `tests/e2e/ui/visual-baseline.spec.ts`

**Step 1: 写视觉基线失败测试**

断言：
- 首页整体为深色背景
- 卡片区不是纯表格
- 审核页使用与前台一致的布局基线

Run:

```bash
pnpm exec playwright test tests/e2e/ui/visual-baseline.spec.ts
```

Expected:
- FAIL

**Step 2: 实现最小视觉令牌**

至少定义：
- 背景色
- 卡片色
- 边框色
- 文字层级
- 主按钮样式

**Step 3: 回归**

Run:

```bash
pnpm exec playwright test tests/e2e/ui/visual-baseline.spec.ts
```

Expected:
- PASS

**Step 4: 提交**

Run:

```bash
git add apps/web/src/app/globals.css tests/e2e/ui/visual-baseline.spec.ts
git commit -m "style: add dark visual baseline"
```

### Task 16: Compose 部署先写冒烟验收，再补容器化

**Files:**
- Create: `apps/web/Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `scripts/smoke-compose.ps1`
- Test: `tests/concurrency/compose-smoke.md`

**Step 1: 先写部署验收清单**

Create `tests/concurrency/compose-smoke.md`，记录：
- 启动命令
- 健康检查命令
- 预期端口
- 预期挂载卷

Run:

```bash
docker compose config
```

Expected:
- 先 FAIL 或配置为空，暴露尚未定义的服务

**Step 2: 实现最小 Compose**

要求：
- 服务仅含 `web` 与 `postgres`
- `postgres` 使用命名卷
- `web` 依赖数据库并暴露 `3000`

**Step 3: 添加本地烟雾脚本**

`scripts/smoke-compose.ps1` 依次执行：
- `docker compose up -d --build`
- `docker compose ps`
- `Invoke-WebRequest http://localhost:3000/api/health`

**Step 4: 回归**

Run:

```bash
docker compose up -d --build
docker compose ps
curl http://localhost:3000/api/health
```

Expected:
- `web` 与 `postgres` 均为 `running`
- 健康接口返回 `{"status":"ok"}`

**Step 5: 提交**

Run:

```bash
git add apps/web/Dockerfile docker-compose.yml .env.example scripts/smoke-compose.ps1 tests/concurrency/compose-smoke.md
git commit -m "chore: add compose deployment"
```

### Task 17: 补并发测试脚本与 Markdown 报告模板

**Files:**
- Create: `tests/concurrency/search-and-submit.js`
- Create: `docs/并发测试报告-模板.md`
- Test: `docs/并发测试报告-20260423-搜索与投稿.md`

**Step 1: 先写并发场景定义**

`tests/concurrency/search-and-submit.js` 至少包含：
- `20` 并发搜索用户
- `10` 并发投稿用户
- 命中 `/api/prompts` 与 `/api/prompts/[slug]/submissions`

Run:

```bash
docker run --rm -i grafana/k6 run - < tests/concurrency/search-and-submit.js
```

Expected:
- 初次可能 FAIL，暴露尚未就绪的登录态、种子数据或接口稳定性问题

**Step 2: 建立报告模板**

Create `docs/并发测试报告-模板.md`，固定栏目：
- 测试日期
- 测试环境
- 测试场景
- 测试命令
- 并发参数
- 结果摘要
- 异常与问题
- 结论

**Step 3: 首次执行并生成真实报告**

Create `docs/并发测试报告-20260423-搜索与投稿.md`，必须填写：
- 实际执行命令
- 成功率
- 失败请求数
- 是否出现重复版本号

**Step 4: 回归**

Run:

```bash
docker run --rm -i grafana/k6 run - < tests/concurrency/search-and-submit.js
```

Expected:
- 成功率可量化
- 报告已落盘到 `docs/*.md`

**Step 5: 提交**

Run:

```bash
git add tests/concurrency docs/并发测试报告-模板.md docs/并发测试报告-20260423-搜索与投稿.md
git commit -m "test: add concurrency test assets and report template"
```

### Task 18: 最终验收与仓库收口

**Files:**
- Create: `docs/验收记录-20260423.md`

**Step 1: 运行最小完整回归**

Run:

```bash
pnpm exec vitest run
pnpm exec playwright test
docker compose up -d --build
docker run --rm -i grafana/k6 run - < tests/concurrency/search-and-submit.js
```

Expected:
- 单元、集成、E2E、Compose、并发全部完成一次

**Step 2: 写验收记录**

`docs/验收记录-20260423.md` 至少记录：
- 执行时间
- 执行命令
- 结果摘要
- 未解决问题
- 是否可进入试运行

**Step 3: 检查 Git 工作区只包含本期文件**

Run:

```bash
git status --short
```

Expected:
- 仅出现本计划涉及的新增文件或可解释的生成文件

**Step 4: 最终提交**

Run:

```bash
git add .
git commit -m "feat: deliver prompt asset platform mvp skeleton"
```

Expected:
- 形成可回滚的验收节点

## 关键数据模型速记

- `users`
  - `role`: `viewer | editor | admin`
- `categories`
  - `status`: `active | disabled`
- `prompts`
  - `status`: `draft | published | archived`
  - `current_version_id` 指向当前生效版本
- `prompt_versions`
  - `source_type`: `create | edit | submission | rollback`
  - `review_status`: `pending | approved | rejected`
- `prompt_likes`
  - 唯一键：`(prompt_id, user_id)`
- `audit_logs`
  - 必须覆盖创建、投稿、审核、点赞

## 验收门槛

- 首页满足已确认基线：左侧分类、顶部搜索、卡片网格、深色背景、右上角 `导入/管理/创建`
- 详情页能展示当前版本与历史版本
- 投稿生成 `pending` 版本，不立即切换当前版本
- 管理员审核通过后切换当前版本，拒绝后保留记录
- `docker compose up -d --build` 可启动
- 并发测试执行结果必须落盘到 `docs/*.md`

## 执行顺序建议

1. 先完成 Task 1-5，把工作区、测试框架、领域规则、迁移打牢。
2. 再完成 Task 6-10，打通浏览与详情主链路。
3. 然后完成 Task 11-14，补齐复制、点赞、投稿、审核、日志。
4. 最后完成 Task 15-18，收口视觉基线、Compose、并发测试和验收。

Plan complete and saved to `docs/plans/2026-04-23-方案3-极简提示词资产平台-implementation.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
