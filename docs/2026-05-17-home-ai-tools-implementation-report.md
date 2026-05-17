# 2026-05-17 首页 AI 工具小卡片实现验收记录

## 变更范围

- `apps/web/app/_home/home-ai-tools.ts`
- `apps/web/app/_home/home-ai-tools-section.jsx`
- `apps/web/app/_home/home-page-shell.jsx`
- `apps/web/app/globals.css`

## 验证命令

### 1. 配置数据校验

```powershell
@'
import assert from "node:assert/strict";
import { HOME_AI_TOOLS } from "./app/_home/home-ai-tools.ts";

assert.equal(HOME_AI_TOOLS.length, 3);
assert.deepEqual(HOME_AI_TOOLS.map((item) => item.name), ["CEIC Chat", "ChatGPT", "Claude"]);
assert.match(HOME_AI_TOOLS[0].href, /^https:\/\//);
console.log("HOME_AI_TOOLS_OK", JSON.stringify(HOME_AI_TOOLS.map((item) => ({ name: item.name, href: item.href }))));
'@ | node --experimental-strip-types --input-type=module -
```

结果摘要：

- 通过，输出 `HOME_AI_TOOLS_OK`。
- 已确认工具配置为 3 条，名称分别为 `CEIC Chat`、`ChatGPT`、`Claude`。

### 2. Web 构建检查

```powershell
npm run build
```

结果摘要：

- Next 构建阶段中，首页相关代码已完成编译：`Compiled successfully`。
- 整体 `build` 未通过，阻塞于仓库现有无关类型错误：
  - 文件：`apps/web/app/api/admin/prompts/[slug]/archive/route.ts`
  - 错误：`Property 'code' does not exist on type 'AdminPromptStatusMutationResult'.`

## 结论

- 本次首页 AI 工具区代码已落地并通过配置数据校验。
- 整体生产构建当前受现有后端路由类型错误阻塞，非本次首页改动引入。
