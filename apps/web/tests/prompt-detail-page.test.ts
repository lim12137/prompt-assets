import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  PromptDetailContent,
  sortVersionsDesc,
  type PromptDetailView,
} from "../app/prompts/[slug]/_detail-content.js";

function createFixtureDetail(): PromptDetailView {
  return {
    slug: "js-code-reviewer",
    title: "JavaScript 代码审查助手",
    summary: "识别异味并给出可执行修复建议。",
    category: {
      slug: "programming",
      name: "编程",
    },
    currentVersion: {
      versionNo: "v0002",
      sourceType: "edit",
      submittedAt: "2026-01-02T00:00:00.000Z",
      content: "当前版本正文：输出风险等级与修复 patch。",
    },
    versions: [
      {
        versionNo: "v0001",
        sourceType: "create",
        submittedAt: "2026-01-01T00:00:00.000Z",
        status: "approved",
        content: "历史版本正文：初始规则集。",
      },
      {
        versionNo: "v0003",
        sourceType: "submission",
        submittedAt: "2026-01-03T00:00:00.000Z",
        status: "rejected",
        content: "rejected 不应暴露的正文。",
      },
      {
        versionNo: "v0002",
        sourceType: "edit",
        submittedAt: "2026-01-02T00:00:00.000Z",
        status: "approved",
        content: "当前版本正文：输出风险等级与修复 patch。",
      },
    ],
  };
}

test("详情页渲染标题/分类/摘要/当前版本正文", () => {
  const detail = createFixtureDetail();
  const html = renderToStaticMarkup(
    createElement(PromptDetailContent, { detail }),
  );

  assert.match(html, /JavaScript 代码审查助手/);
  assert.match(html, /分类：编程/);
  assert.match(html, /识别异味并给出可执行修复建议。/);
  assert.match(html, /当前版本正文：输出风险等级与修复 patch。/);
});

test("历史版本按版本号倒序，且当前版本有标识", () => {
  const sorted = sortVersionsDesc(createFixtureDetail().versions);
  assert.deepEqual(
    sorted.map((item) => item.versionNo),
    ["v0003", "v0002", "v0001"],
  );

  const html = renderToStaticMarkup(
    createElement(PromptDetailContent, { detail: createFixtureDetail() }),
  );
  const historyStart = html.indexOf("历史版本");
  const historyHtml = historyStart >= 0 ? html.slice(historyStart) : html;
  const idxV3 = historyHtml.indexOf("v0003");
  const idxV2 = historyHtml.indexOf("v0002");
  const idxV1 = historyHtml.indexOf("v0001");

  assert.ok(idxV3 < idxV2 && idxV2 < idxV1, "历史版本应按倒序显示");
  assert.match(html, /v0002（当前版本）/);
});

test("rejected 历史版本不暴露正文", () => {
  const html = renderToStaticMarkup(
    createElement(PromptDetailContent, { detail: createFixtureDetail() }),
  );

  assert.equal(
    html.includes("rejected 不应暴露的正文。"),
    false,
    "rejected 版本正文不应出现在详情页",
  );
  assert.match(html, /该版本正文不可见/);
});
