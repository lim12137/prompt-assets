import { createElement } from "react";

/**
 * @typedef {"approved" | "pending" | "rejected"} PromptVersionStatus
 */

/**
 * @typedef {object} PromptDetailVersionView
 * @property {string} versionNo
 * @property {string} sourceType
 * @property {string} submittedAt
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
 * @param {{ detail: PromptDetailView }} props
 */
export function PromptDetailContent({ detail }) {
  const versions = sortVersionsDesc(detail.versions);

  return createElement(
    "main",
    { className: "prompt-detail-page" },
    createElement("h1", null, detail.title),
    createElement("p", null, `分类：${detail.category.name}`),
    createElement("p", null, detail.summary),
    createElement(
      "section",
      { "aria-label": "当前版本" },
      createElement("h2", null, `当前版本 ${detail.currentVersion.versionNo}`),
      createElement("pre", null, detail.currentVersion.content),
    ),
    createElement(
      "section",
      { "aria-label": "历史版本" },
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
