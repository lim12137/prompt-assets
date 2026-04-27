import test from "node:test";
import assert from "node:assert/strict";

import { mapPromptDetail, type PromptDetailRaw } from "../../../apps/web/lib/api/prompt-mappers.ts";

function buildRawWithCrossPromptCurrentVersion(): PromptDetailRaw {
  return {
    slug: "ux-research-plan",
    title: "UX 研究计划器",
    summary: "快速生成访谈与可用性测试计划。",
    likesCount: 0,
    updatedAt: "2026-04-27T00:00:00.000Z",
    categorySlug: "design",
    categoryName: "设计",
    currentVersionNo: "v9999",
    currentVersionSourceType: "edit",
    currentVersionSubmittedAt: "2026-04-27T00:00:00.000Z",
    currentVersionContent: "cross-prompt-foreign-content",
    versions: [
      {
        versionNo: "v0002",
        sourceType: "edit",
        status: "approved",
        submittedAt: "2026-04-26T00:00:00.000Z",
        submittedBy: "alice@example.com",
        content: "ux-v2-content",
      },
      {
        versionNo: "v0001",
        sourceType: "create",
        status: "approved",
        submittedAt: "2026-04-25T00:00:00.000Z",
        submittedBy: "admin@example.com",
        content: "ux-v1-content",
      },
    ],
  };
}

test("mapPromptDetail: currentVersion 必须属于当前 prompt 的 versions 集合", () => {
  const detail = mapPromptDetail(buildRawWithCrossPromptCurrentVersion());

  assert.equal(detail.currentVersion.versionNo, "v0002");
  assert.equal(detail.currentVersion.content, "ux-v2-content");
  assert.equal(
    detail.versions.some((item) => item.versionNo === detail.currentVersion.versionNo),
    true,
  );
});
