import test from "node:test";
import assert from "node:assert/strict";

import { parseAppEnv } from "./env.ts";

function summarizeTools(tools: Array<{
  name: string;
  description: string;
  href: string;
  accentColor: string;
  iconBackground: string;
  iconKey: string;
}>) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    href: tool.href,
    accentColor: tool.accentColor,
    iconBackground: tool.iconBackground,
    iconKey: tool.iconKey,
  }));
}

test("未提供 AI_TOOLS 时应返回默认首页 AI 工具配置", () => {
  const env = parseAppEnv({
    DATABASE_URL: "postgres://user:pass@localhost:5432/prompt_db",
  });

  assert.deepEqual(summarizeTools(env.homeAiTools), [
    {
      name: "CEIC Chat",
      description: "企业内对话入口",
      href: "https://chat.ceic.com",
      accentColor: "#d92d20",
      iconBackground: "#fde8e7",
      iconKey: "ceic",
    },
    {
      name: "ChatGPT",
      description: "通用问答与写作",
      href: "https://chatgpt.com",
      accentColor: "#f97316",
      iconBackground: "#fff4e8",
      iconKey: "chatgpt",
    },
    {
      name: "Claude",
      description: "长文本与分析辅助",
      href: "https://claude.ai",
      accentColor: "#7c4a2d",
      iconBackground: "#f5efe9",
      iconKey: "claude",
    },
  ]);
});

test("AI_TOOLS 与 AI_TOOL_<SLUG>_* 应支持覆盖名称链接描述与排序", () => {
  const env = parseAppEnv({
    DATABASE_URL: "postgres://user:pass@localhost:5432/prompt_db",
    AI_TOOLS: "claude,ceic-chat,chatgpt",
    AI_TOOL_CLAUDE_ORDER: "30",
    AI_TOOL_CLAUDE_NAME: "Claude Pro",
    AI_TOOL_CLAUDE_URL: "https://claude.ai/new",
    AI_TOOL_CLAUDE_DESC: "更长文本分析",
    AI_TOOL_CEIC_CHAT_ORDER: "10",
    AI_TOOL_CHATGPT_ORDER: "20",
  });

  assert.deepEqual(
    env.homeAiTools.map((tool) => ({
      name: tool.name,
      href: tool.href,
      description: tool.description,
    })),
    [
      {
        name: "CEIC Chat",
        href: "https://chat.ceic.com",
        description: "企业内对话入口",
      },
      {
        name: "ChatGPT",
        href: "https://chatgpt.com",
        description: "通用问答与写作",
      },
      {
        name: "Claude Pro",
        href: "https://claude.ai/new",
        description: "更长文本分析",
      },
    ],
  );
});

test("AI_TOOLS 包含未知 slug 时缺少必填字段应抛出错误", () => {
  assert.throws(
    () =>
      parseAppEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/prompt_db",
        AI_TOOLS: "chatgpt,claude,custom-tool",
      }),
    /AI_TOOL_CUSTOM_TOOL_NAME/,
  );
});

test("AI_TOOLS 出现重复 slug 时应抛出错误", () => {
  assert.throws(
    () =>
      parseAppEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/prompt_db",
        AI_TOOLS: "chatgpt,claude,chatgpt",
      }),
    /duplicate/i,
  );
});

test("AI_TOOLS 数量不是 3 时应抛出错误", () => {
  assert.throws(
    () =>
      parseAppEnv({
        DATABASE_URL: "postgres://user:pass@localhost:5432/prompt_db",
        AI_TOOLS: "chatgpt,claude",
      }),
    /expected 3 tools/i,
  );
});
