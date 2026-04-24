import { createElement } from "react";
import { PromptActions } from "./_prompt-actions.js";
import { CopyCardButton } from "./_copy-card-button.js";

/**
 * @typedef {"approved" | "pending" | "rejected"} PromptVersionStatus
 */

/**
 * @typedef {object} PromptDetailVersionView
 * @property {string} versionNo
 * @property {string} sourceType
 * @property {string} submittedAt
 * @property {string | undefined} [submittedBy]
 * @property {PromptVersionStatus} status
 * @property {string | undefined} [content]
 */

/**
 * @typedef {object} PromptDetailView
 * @property {string} slug
 * @property {string} title
 * @property {string} summary
 * @property {{ slug: string; name: string }} category
 * @property {{ versionNo: string; sourceType: string; submittedAt: string; content: string }} currentVersion
 * @property {PromptDetailVersionView[]} versions
 */

function toVersionNumber(versionNo) {
  const normalized = String(versionNo ?? "")
    .replace(/^v/i, "")
    .trim();
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : -1;
}

function toVersionTimestamp(value) {
  const parsed = new Date(value ?? "");
  const time = parsed.getTime();
  return Number.isFinite(time) ? time : -1;
}

/**
 * @param {PromptDetailVersionView[]} versions
 */
export function sortVersionsDesc(versions) {
  return [...(versions ?? [])].sort((left, right) => {
    const byNo = toVersionNumber(right.versionNo) - toVersionNumber(left.versionNo);
    if (byNo !== 0) {
      return byNo;
    }
    return String(right.submittedAt ?? "").localeCompare(String(left.submittedAt ?? ""));
  });
}

/**
 * @param {PromptDetailVersionView[]} versions
 */
function pickLatestCandidateByEmployee(versions) {
  const candidates = [...(versions ?? [])]
    .filter(
      (item) =>
        item.sourceType === "submission" &&
        item.status === "pending" &&
        typeof item.submittedBy === "string" &&
        item.submittedBy.length > 0,
    )
    .sort((left, right) => {
      const byTime = toVersionTimestamp(right.submittedAt) - toVersionTimestamp(left.submittedAt);
      if (byTime !== 0) {
        return byTime;
      }
      return toVersionNumber(right.versionNo) - toVersionNumber(left.versionNo);
    });

  const latestByEmployee = new Map();
  for (const candidate of candidates) {
    const key = String(candidate.submittedBy);
    if (!latestByEmployee.has(key)) {
      latestByEmployee.set(key, candidate);
    }
  }
  return [...latestByEmployee.values()];
}

/**
 * @param {{ detail: PromptDetailView }} props
 */
export function PromptDetailContent({ detail }) {
  const versions = sortVersionsDesc(detail.versions);
  const employeeCandidateCards = pickLatestCandidateByEmployee(versions);

  return createElement(
    "main",
    { className: "prompt-detail-page" },
    createElement("h1", { className: "pm-page-title" }, `提示词详情：${detail.title}`),
    createElement("p", null, `分类：${detail.category.name}`),
    createElement("p", null, detail.summary),
    createElement(PromptActions, {
      slug: detail.slug,
      initialLikesCount: detail.likesCount,
      currentVersionContent: detail.currentVersion.content,
    }),
    createElement(
      "section",
      { "aria-label": "当前版本", className: "prompt-detail-panel", "data-testid": "official-card" },
      createElement("h2", null, "官方推荐卡"),
      createElement("p", null, `版本：${detail.currentVersion.versionNo}`),
      createElement("pre", null, detail.currentVersion.content),
      createElement(CopyCardButton, { content: detail.currentVersion.content }),
    ),
    createElement(
      "section",
      { "aria-label": "员工候选版本", className: "prompt-detail-panel" },
      createElement("h2", null, "员工候选卡"),
      employeeCandidateCards.length === 0
        ? createElement("p", null, "暂无员工候选卡")
        : createElement(
            "div",
            { style: { display: "grid", gap: "10px" } },
            ...employeeCandidateCards.map((card) =>
              createElement(
                "article",
                {
                  key: `${card.submittedBy}-${card.versionNo}`,
                  className: "pm-card",
                  "data-testid": "employee-candidate-card",
                  style: { display: "grid", gap: "8px" },
                },
                createElement("h3", { style: { margin: 0 } }, `${card.submittedBy} 的候选卡`),
                createElement("p", { style: { margin: 0 } }, `版本：${card.versionNo}`),
                createElement("p", { style: { margin: 0 } }, `状态：${card.status}`),
                createElement("pre", null, card.content ?? ""),
                createElement(CopyCardButton, { content: card.content ?? "" }),
              ),
            ),
          ),
    ),
    createElement(
      "section",
      { "aria-label": "历史版本", className: "prompt-detail-panel" },
      createElement("h2", null, "历史版本"),
      createElement(
        "ol",
        null,
        ...versions.map((version) =>
          createElement(
            "li",
            { key: version.versionNo },
            createElement(
              "h3",
              null,
              version.versionNo === detail.currentVersion.versionNo
                ? `${version.versionNo}（当前版本）`
                : version.versionNo,
            ),
            createElement("p", null, `状态：${version.status}`),
            version.status === "rejected"
              ? createElement("p", null, "该版本正文不可见")
              : createElement("pre", null, version.content ?? ""),
          ),
        ),
      ),
    ),
  );
}
