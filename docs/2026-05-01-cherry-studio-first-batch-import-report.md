# Cherry Studio 首批提示词导入执行报告

- 执行日期：2026-05-01
- 执行人：Codex 子代理
- 导入源文件：`Cherry Studio首批助手导入包/cherry-studio-first-batch.import.json`
- 导入目标：本仓库真实 PostgreSQL 数据库 `prompt_management`

## 1. 导入路径与前提确认

确认结果：

1. 导入接口已存在：`apps/web/app/api/admin/prompts/import/route.ts`
2. 导入实现走仓库内 `importPrompts(...)`，在数据库可达时写入真实库。
3. 本地调试数据库容器已运行且健康：
   - 容器名：`prompt-assets-local-db`
   - 映射端口：`127.0.0.1:55432`
4. 发现一个实际前提差异：
   - 根目录 `.env` / `packages/db/.env` 默认指向 `127.0.0.1:5432`
   - 当前本地调试库实际使用 `127.0.0.1:55432`
   - 因此直接跑 `pnpm db:migrate` 会连错端口，已改用仓库自带 `pnpm local:prepare` 作为最稳妥路径。

## 2. 实际执行命令

### 2.1 检查数据库容器状态

```powershell
pnpm local:db:status
```

结果摘要：

- `prompt-assets-local-db` 为 `Up ... (healthy)`

### 2.2 初始化真实库（迁移 + seed）

```powershell
pnpm local:prepare
```

结果摘要：

- `db:migrate`: `No pending migrations.`
- `db:seed`: 成功写入基线数据
- seed 摘要：
  - categories: `4`
  - prompts: `10`
  - promptVersions: `17`
  - submissions: `3`

### 2.3 导入前预检目标 slug 是否已存在

```powershell
@'
import fs from "node:fs/promises";
import { Client } from "pg";

const raw = await fs.readFile("..\\..\\Cherry Studio首批助手导入包\\cherry-studio-first-batch.import.json", "utf8");
const items = JSON.parse(raw);
const slugs = items.map((item) => item.slug);
const client = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:55432/prompt_management" });
await client.connect();
const result = await client.query("select slug from prompts where slug = any($1::text[]) order by slug asc", [slugs]);
console.log(JSON.stringify({ total: slugs.length, existing: result.rows.map((row) => row.slug) }, null, 2));
await client.end();
'@ | pnpm --filter @prompt-management/db exec node --input-type=module
```

结果摘要：

- 目标总数：`16`
- 已存在：`[]`

### 2.4 直接调用仓库导入路由执行导入

```powershell
@'
process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:55432/prompt_management";
process.env.LOGIN_TOKEN_SECRET = "local-dev-secret-change-me";

const fs = await import("node:fs/promises");
const { POST } = await import("./apps/web/app/api/admin/prompts/import/route.ts");
const { buildAuthCookie } = await import("./tests/integration/api/_auth-test-helpers.ts");

const raw = await fs.readFile("./Cherry Studio首批助手导入包/cherry-studio-first-batch.import.json", "utf8");
const request = new Request("http://localhost:3010/api/admin/prompts/import", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    cookie: buildAuthCookie({ uid: "12061413", name: "Admin", can_manage: true }),
  },
  body: raw,
});

const response = await POST(request);
const payload = await response.json();
console.log(JSON.stringify({ status: response.status, payload }, null, 2));
'@ | node --experimental-strip-types --input-type=module
```

结果摘要：

- HTTP 状态：`201`
- 导入模式：`all_or_nothing`
- 成功导入：`16` 条
- 返回的导入结果中 16 条 prompt 均为 `published`

## 3. 最小验收

### 3.1 直接查真实库

```powershell
@'
import fs from "node:fs/promises";
import { Client } from "pg";

const raw = await fs.readFile("..\\..\\Cherry Studio首批助手导入包\\cherry-studio-first-batch.import.json", "utf8");
const items = JSON.parse(raw);
const slugs = items.map((item) => item.slug);
const client = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:55432/prompt_management" });
await client.connect();
const countResult = await client.query(
  `select count(*)::int as total from prompts where slug = any($1::text[])`,
  [slugs],
);
const sampleResult = await client.query(
  `select p.slug, p.title, pv.version_no
   from prompts p
   join prompt_versions pv on pv.id = p.current_version_id
   where p.slug = any($1::text[])
   order by p.slug asc
   limit 5`,
  [slugs],
);
console.log(JSON.stringify({ total: countResult.rows[0]?.total ?? 0, sample: sampleResult.rows }, null, 2));
await client.end();
'@ | pnpm --filter @prompt-management/db exec node --input-type=module
```

结果摘要：

- 目标 slug 入库数：`16 / 16`
- 抽样可见 `academic-researcher`、`administration`、`business-data-analysis`、`content-summarizer`、`data-analyst`
- 抽样版本号均为 `v0001`

### 3.2 抽查详情读取

```powershell
@'
process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:55432/prompt_management";

const { GET } = await import("./apps/web/app/api/prompts/[slug]/route.ts");

const slugs = ["business-data-analysis", "meeting-summary"];
const results = [];
for (const slug of slugs) {
  const response = await GET(new Request(`http://localhost:3010/api/prompts/${slug}`), { params: { slug } });
  const body = await response.json();
  results.push({ slug, status: response.status, title: body?.title ?? null, currentVersionNo: body?.currentVersion?.versionNo ?? null });
}
console.log(JSON.stringify(results, null, 2));
'@ | node --experimental-strip-types --input-type=module
```

结果摘要：

- `business-data-analysis`: `200`, `v0001`
- `meeting-summary`: `200`, `v0001`

## 4. 结论

本次已按最稳妥路径完成真实入库：

1. 使用仓库既有导入接口执行，而不是手工改库。
2. 导入前确认数据库容器健康、迁移和 seed 完成。
3. 导入后通过真实库查询和详情读取双重验证。

最终结论：

- Cherry Studio 首批提示词 `16` 条已成功导入当前系统真实数据库。
- 本次无代码逻辑改动，仅新增本执行报告用于留痕。

## 5. 阻塞与异常

本次无阻塞导致导入失败，但发现一个环境差异：

- 默认数据库端口配置为 `5432`
- 本地调试库实际端口为 `55432`

这不会影响本次结果，因为本次已显式使用 `local:prepare` 和正确的 `DATABASE_URL` 完成导入。
