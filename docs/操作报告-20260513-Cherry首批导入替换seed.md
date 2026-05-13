# 操作报告：以 Cherry 首批导入包替换 seed 示例 prompt（2026-05-13）

## 目标

- 保留 `categories`
- 保留现有 `users`
- 删除 prompt 侧 seed 数据后导入 `Cherry Studio首批助手导入包`
- 验证返回结果已是 Cherry 数据而非 seed 默认数据

## 选定导入包

- 文件：`Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json`
- 原因：当前站点内容以中文为主，中文包更适合直接上线验证

## 只读确认的可复用入口

- 清理脚本：`scripts/cleanup-real-db-sample-prompts.mjs`
- 导入 API 路由：`apps/web/app/api/admin/prompts/import/route.ts`
- 真实 DB 写入能力：`apps/web/lib/api/prompt-repository.ts` 导出的 `createPrompt()`

## 执行前基线

命令：

```powershell
@'
import pg from './packages/db/node_modules/pg/lib/index.js';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const [counts, cats, users, prompts] = await Promise.all([
  client.query(`select
    (select count(*)::int from categories) as categories,
    (select count(*)::int from users) as users,
    (select count(*)::int from prompts) as prompts,
    (select count(*)::int from prompt_versions) as prompt_versions,
    (select count(*)::int from prompt_categories) as prompt_categories,
    (select count(*)::int from submissions) as submissions,
    (select count(*)::int from prompt_likes) as prompt_likes,
    (select count(*)::int from audit_logs) as audit_logs;`),
  client.query(`select slug,name from categories order by sort_order, slug;`),
  client.query(`select email, role from users order by id;`),
  client.query(`select slug,title from prompts order by slug;`)
]);
console.log(JSON.stringify({counts: counts.rows[0], categories: cats.rows, users: users.rows, prompts: prompts.rows}, null, 2));
await client.end();
'@ | node --env-file=.env --input-type=module -
```

结果摘要：

- `categories=4`
- `users=4`
- `prompts=10`
- 10 条 prompt 全为 seed 默认数据

## 清理 dry-run

命令：

```powershell
node --env-file=.env scripts/cleanup-real-db-sample-prompts.mjs --dry-run --slug api-debug-assistant --slug blog-outline-generator --slug figma-wireframe-brief --slug js-code-reviewer --slug landing-copy-framework --slug newsletter-polisher --slug short-video-script --slug social-hook-pack --slug sql-index-advisor --slug ux-research-plan
```

结果摘要：

- `foundCount=10`
- `missingSlugs=[]`
- 预计删除：
  - `prompts=10`
  - `prompt_versions=17`
  - `prompt_categories=10`
  - `submissions=3`
  - `prompt_likes=14`

## 正式清理

命令：

```powershell
node --env-file=.env scripts/cleanup-real-db-sample-prompts.mjs --confirm --operator codex-subagent --reason "replace seed prompts with Cherry Studio first batch zh-CN import" --slug api-debug-assistant --slug blog-outline-generator --slug figma-wireframe-brief --slug js-code-reviewer --slug landing-copy-framework --slug newsletter-polisher --slug short-video-script --slug social-hook-pack --slug sql-index-advisor --slug ux-research-plan
```

结果摘要：

- 已删除 10 条 seed prompt
- 删除后计数：
  - `prompts=0`
  - `prompt_versions=0`
  - `prompt_categories=0`
  - `submissions=0`
  - `prompt_likes=0`
  - `categories=4`（保留）
  - `users=4`（保留）

## 导入执行

### 先验证现有导入 API 路由

命令：

```powershell
@'
import { readFile } from 'node:fs/promises';
import { POST } from './apps/web/app/api/admin/prompts/import/route.ts';
import { buildAuthCookie } from './tests/integration/api/_auth-test-helpers.ts';
process.env.LOGIN_TOKEN_SECRET ||= 'local-dev-secret-change-me';
process.env.PROMPT_REPOSITORY_DATA_SOURCE = 'auto';
const items = JSON.parse(await readFile('./Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json', 'utf8'));
const request = new Request('http://127.0.0.1:3010/api/admin/prompts/import', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    cookie: buildAuthCookie({ uid: 'admin@example.com', name: 'Admin', can_manage: true }),
  },
  body: JSON.stringify(items),
});
const response = await POST(request);
const payload = await response.json();
console.log(JSON.stringify({ status: response.status, payload }, null, 2));
'@ | node --env-file=.env --experimental-strip-types --input-type=module -
```

结果摘要：

- 返回 `201`
- 返回体显示 `total=16`
- 但随后核验真实库仍是 `prompts=0`
- 结论：空库场景下该导入路径回退到 fixture，未写入目标真实库

### 改用现有真实 DB 写入口完成导入

说明：

- 未改业务代码
- 复用 `apps/web/lib/api/prompt-repository.ts` 已导出的 `createPrompt()`
- 该路径在空库场景可进入真实 DB 写入

命令：

```powershell
@'
import { readFile } from 'node:fs/promises';
import { createPrompt } from './apps/web/lib/api/prompt-repository.ts';
process.env.PROMPT_REPOSITORY_DATA_SOURCE = 'auto';
const items = JSON.parse(await readFile('./Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json', 'utf8'));
const results = [];
for (const item of items) {
  const result = await createPrompt({
    creatorEmail: 'admin@example.com',
    creatorRole: 'admin',
    slug: item.slug,
    title: item.title,
    summary: item.summary,
    content: item.content,
  });
  results.push({ slug: item.slug, ok: result.ok });
  if (!result.ok) {
    console.log(JSON.stringify({ inserted: results, failed: result }, null, 2));
    process.exit(1);
  }
}
console.log(JSON.stringify({ total: results.length, inserted: results }, null, 2));
'@ | node --env-file=.env --experimental-strip-types --input-type=module -
```

结果摘要：

- `total=16`
- 16 条全部成功写入真实库

## 导入后验证

### 真实库计数验证

命令：

```powershell
@'
import pg from './packages/db/node_modules/pg/lib/index.js';
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const counts = await client.query(`select
  (select count(*)::int from categories) as categories,
  (select count(*)::int from users) as users,
  (select count(*)::int from prompts) as prompts,
  (select count(*)::int from prompt_versions) as prompt_versions,
  (select count(*)::int from prompt_categories) as prompt_categories,
  (select count(*)::int from submissions) as submissions,
  (select count(*)::int from prompt_likes) as prompt_likes,
  (select count(*)::int from audit_logs) as audit_logs;`);
const prompts = await client.query(`select slug,title from prompts order by slug;`);
console.log(JSON.stringify({ counts: counts.rows[0], prompts: prompts.rows }, null, 2));
await client.end();
'@ | node --env-file=.env --input-type=module -
```

结果摘要：

- `categories=4`
- `users=4`
- `prompts=16`
- `prompt_versions=16`
- `prompt_categories=16`
- `submissions=0`
- `prompt_likes=0`
- `audit_logs=17`

### `/api/prompts` 语义验证（直调仓库列表逻辑）

命令：

```powershell
@'
process.env.DATABASE_URL = 'postgres://app_user:ChangeMe_2026_Strong!@10.45.131.70:55432/app_db';
process.env.PROMPT_REPOSITORY_DATA_SOURCE = 'auto';
const { listPrompts } = await import('./apps/web/lib/api/prompt-repository.ts');
const prompts = await listPrompts();
console.log(JSON.stringify(prompts.slice(0, 10), null, 2));
'@ | node --env-file=.env --experimental-strip-types --input-type=module -
```

结果摘要：

- 返回结果已是 Cherry 数据，不再是 seed 默认数据
- 证据（至少 3 条）：
  - `writing-materials-collector` / `写作资料采集助手`
  - `journalist` / `新闻写作记者`
  - `academic-researcher` / `学术研究助手`
  - `legal-affairs` / `法务顾问`
  - `project-management` / `项目管理顾问`

## 风险与备注

- 本地运行中的 `http://127.0.0.1:3010/api/prompts` 当时仍返回 seed 数据，说明该服务进程未连到本次操作的目标真实库；因此最终验收以真实库查询和 `listPrompts()` 直调结果为准。
- 现有 `POST /api/admin/prompts/import` 在空库场景会因 `canReadFromDatabase()` 判定依赖“最小 prompt 数据存在”而回退到 fixture，这会导致“返回 201 但未写入真实库”的偏差。本次未改业务代码，仅绕过该偏差完成导入。
