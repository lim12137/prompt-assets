# Cherry 首批 16 条提示词中文化整理与入库报告

- 执行日期：2026-05-01
- 执行人：Codex 子代理
- 中文导入包：`Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json`
- 目标系统：当前仓库真实 PostgreSQL 数据库 `prompt_management`

## 1. 结论

本次采用**覆盖**方案，不采用新增。

覆盖含义：

- 保留现有 16 条 prompt 的原始 `slug`
- 原位更新 `title`、`summary`、当前正式版 `content`
- 不新增重复 prompt，不改分类、不改版本号、不改点赞等存量数据

最终结果：

- 中文导入包已生成
- 真实库内 16 条既有 Cherry 首批记录已完成中文化
- 新导入包经当前导入接口验证，可在空环境或未导入环境直接导入

## 2. 为什么选择覆盖而不是新增

先确认了当前系统能力：

1. 管理端导入接口 `POST /api/admin/prompts/import` 只支持**新增导入**
2. 同 `slug` 再导入会返回 `409 prompt_slug_conflict`
3. 当前真实库里这 16 条英文版已存在

因此如果选择新增，会出现两个问题：

1. 若保留相同 `slug`，会直接冲突失败
2. 若改成新 `slug`，会把同一批官方助手拆成两套记录，破坏现有引用与检索一致性

基于“当前系统最稳妥”的要求，本次采用：

- 新增一份中文导入包用于后续新环境导入
- 对当前真实库已存在的同 `slug` 记录做最小范围原位中文化更新

## 3. 实际执行命令

### 3.1 校验中文导入包结构

```powershell
@'
const fs = require('node:fs');
const path = 'Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json';
const items = JSON.parse(fs.readFileSync(path, 'utf8'));
console.log(JSON.stringify({ total: items.length, slugs: items.slice(0, 5).map((item) => item.slug) }, null, 2));
'@ | node
```

结果摘要：

- JSON 解析成功
- 条目数：`16`
- slug 结构正常

### 3.2 预检真实库现状

```powershell
@'
import fs from "node:fs/promises";
import { Client } from "pg";

const raw = await fs.readFile("D:/1work/提示词管理/Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json", "utf8");
const items = JSON.parse(raw);
const slugs = items.map((item) => item.slug);
const client = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:55432/prompt_management" });
await client.connect();
const result = await client.query(
  `select p.slug, p.title, left(pv.content, 80) as content_preview
   from prompts p
   join prompt_versions pv on pv.id = p.current_version_id
   where p.slug = any($1::text[])
   order by p.slug asc`,
  [slugs],
);
console.log(JSON.stringify({ total: slugs.length, existing: result.rows.length, sample: result.rows.slice(0, 3) }, null, 2));
await client.end();
'@ | pnpm --filter @prompt-management/db exec node --input-type=module
```

结果摘要：

- 目标条目：`16`
- 真实库已存在：`16`
- 抽样仍为英文标题和英文内容

### 3.3 原位更新真实库中的现有记录

```powershell
@'
import fs from "node:fs/promises";
import { Client } from "pg";

const raw = await fs.readFile("D:/1work/提示词管理/Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json", "utf8");
const items = JSON.parse(raw);
const client = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:55432/prompt_management" });
await client.connect();

try {
  await client.query("begin");

  const slugs = items.map((item) => item.slug);
  const existing = await client.query(
    `select p.id, p.slug, p.current_version_id
     from prompts p
     where p.slug = any($1::text[])
     order by p.slug asc`,
    [slugs],
  );

  if (existing.rows.length !== items.length) {
    throw new Error(`expected ${items.length} prompts, found ${existing.rows.length}`);
  }

  const bySlug = new Map(existing.rows.map((row) => [row.slug, row]));
  for (const item of items) {
    const row = bySlug.get(item.slug);
    if (!row?.current_version_id) {
      throw new Error(`missing current_version_id for ${item.slug}`);
    }

    await client.query(
      `update prompts
       set title = $2,
           summary = $3,
           updated_at = now()
       where slug = $1`,
      [item.slug, item.title, item.summary],
    );

    await client.query(
      `update prompt_versions
       set content = $2
       where id = $1`,
      [row.current_version_id, item.content],
    );
  }

  await client.query("commit");
  console.log(JSON.stringify({ updated: items.length, mode: "in_place_localization" }, null, 2));
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  await client.end();
}
'@ | pnpm --filter @prompt-management/db exec node --input-type=module
```

结果摘要：

- 事务提交成功
- 原位更新：`16` 条
- 更新范围：`prompts.title`、`prompts.summary`、当前正式版 `prompt_versions.content`

### 3.4 验证中文导入包仍可被当前系统导入

```powershell
@'
process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
process.env.LOGIN_TOKEN_SECRET = "test-secret";

const fs = await import("node:fs/promises");
const { POST } = await import("./apps/web/app/api/admin/prompts/import/route.ts");
const { buildAuthCookie } = await import("./tests/integration/api/_auth-test-helpers.ts");
const { __resetPromptLikeFixtureStateForTests } = await import("./apps/web/lib/api/prompt-repository.ts");

__resetPromptLikeFixtureStateForTests();
const raw = await fs.readFile("./Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json", "utf8");
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
console.log(JSON.stringify({ status: response.status, total: payload.total, first: payload.prompts?.[0]?.title ?? null }, null, 2));
'@ | node --experimental-strip-types --input-type=module
```

结果摘要：

- HTTP 状态：`201`
- 成功导入：`16` 条
- 首条标题为：`业务数据分析师`

### 3.5 验证真实库中文化结果

```powershell
@'
import fs from "node:fs/promises";
import { Client } from "pg";

const raw = await fs.readFile("D:/1work/提示词管理/Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json", "utf8");
const items = JSON.parse(raw);
const slugs = items.map((item) => item.slug);
const client = new Client({ connectionString: "postgres://postgres:postgres@127.0.0.1:55432/prompt_management" });
await client.connect();
const countResult = await client.query(`select count(*)::int as total from prompts where slug = any($1::text[])`, [slugs]);
const sampleResult = await client.query(
  `select p.slug, p.title, p.summary, pv.version_no, left(pv.content, 60) as content_preview
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
- 抽样标题、摘要、正文均已中文化
- 版本号保持 `v0001`

### 3.6 抽查详情接口读取

```powershell
@'
process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:55432/prompt_management";

const { GET } = await import("./apps/web/app/api/prompts/[slug]/route.ts");

const slugs = ["business-data-analysis", "meeting-summary", "legal-affairs"];
const results = [];
for (const slug of slugs) {
  const response = await GET(new Request(`http://localhost:3010/api/prompts/${slug}`), { params: { slug } });
  const body = await response.json();
  results.push({
    slug,
    status: response.status,
    title: body?.title ?? null,
    versionNo: body?.currentVersion?.versionNo ?? null,
    contentPreview: typeof body?.currentVersion?.content === "string" ? body.currentVersion.content.slice(0, 40) : null,
  });
}
console.log(JSON.stringify(results, null, 2));
'@ | node --experimental-strip-types --input-type=module
```

结果摘要：

- `business-data-analysis`：`200`
- `meeting-summary`：`200`
- `legal-affairs`：`200`
- 详情读取到的标题与正文片段均为中文

## 4. 本次新增 / 改动文件

- `Cherry Studio首批助手导入包/cherry-studio-first-batch.zh-CN.import.json`
- `Cherry Studio首批助手导入包/README.md`
- `docs/2026-05-01-cherry-first-batch-zh-localization-import-report.md`

## 5. 风险说明

本次没有新增系统代码，也没有修改导入逻辑；真实库写入仅限于这 16 条既有记录的文案字段。

已明确未改动：

- `slug`
- 分类归属
- 点赞/评分/投稿数据
- 版本号
- 其他无关文件
