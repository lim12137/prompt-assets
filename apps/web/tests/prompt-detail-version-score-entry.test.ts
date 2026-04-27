import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PromptDetailContent,
  type PromptDetailView,
} from "../app/prompts/[slug]/_detail-content.js";

function createFixtureDetail(): PromptDetailView {
  return {
    slug: "js-code-reviewer",
    title: "JavaScript 代码审查助手",
    summary: "识别异味并给出可执行修复建议。",
    likesCount: 1,
    category: {
      slug: "programming",
      name: "编程",
    },
    currentVersion: {
      versionNo: "v0001",
      sourceType: "create",
      submittedAt: "2026-01-02T00:00:00.000Z",
      likesCount: 1,
      liked: false,
      content: "当前版本正文",
    },
    versions: [
      {
        versionNo: "v0001",
        sourceType: "create",
        submittedAt: "2026-01-01T00:00:00.000Z",
        status: "approved",
        likesCount: 1,
        liked: false,
        content: "历史版本正文",
      },
    ],
  };
}

test("详情页版本卡包含 1-5 分评分入口与评分统计占位", () => {
  const html = renderToStaticMarkup(
    createElement(PromptDetailContent, { detail: createFixtureDetail() }),
  );

  assert.match(html, /data-testid="version-score-button-1"/);
  assert.match(html, /data-testid="version-score-button-5"/);
  assert.match(html, /评分统计加载中\.\.\./);
});
