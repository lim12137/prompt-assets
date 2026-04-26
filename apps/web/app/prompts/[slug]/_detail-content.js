import { createElement } from "react";
import { PromptActions, VersionLikeAction } from "./_prompt-actions.js";
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
 * @property {number} likesCount
 * @property {boolean} liked
 * @property {string | undefined} [content]
 */

/**
 * @typedef {object} PromptDetailView
 * @property {string} slug
 * @property {string} title
 * @property {string} summary
 * @property {number} likesCount
 * @property {{ slug: string; name: string }} category
 * @property {{ versionNo: string; sourceType: string; submittedAt: string; likesCount: number; liked: boolean; content: string }} currentVersion
 * @property {PromptDetailVersionView[]} versions
 */

function toVersionNumber(versionNo) {
  const normalized = String(versionNo ?? "").replace(/^v/i, "").trim();
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
    if (byNo !== 0) return byNo;
    return String(right.submittedAt ?? "").localeCompare(String(left.submittedAt ?? ""));
  });
}

/**
 * @param {PromptDetailVersionView[]} versions
 */
function pickLatestCandidateByEmployee(versions) {
  const candidates = [...(versions ?? [])]
    .filter((item) => item.sourceType === "submission" && item.status === "pending" && typeof item.submittedBy === "string" && item.submittedBy.length > 0)
    .sort((left, right) => {
      const byVersionNo = toVersionNumber(right.versionNo) - toVersionNumber(left.versionNo);
      if (byVersionNo !== 0) return byVersionNo;
      return toVersionTimestamp(right.submittedAt) - toVersionTimestamp(left.submittedAt);
    });

  const latestByEmployee = new Map();
  for (const candidate of candidates) {
    const key = String(candidate.submittedBy);
    if (!latestByEmployee.has(key)) latestByEmployee.set(key, candidate);
  }
  return [...latestByEmployee.values()];
}

function BackButton() {
  return createElement("a", { href: "/", className: "pm-back-button", "aria-label": "返回首页" },
    createElement("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
      createElement("polyline", { points: "15 18 9 12 15 6" }),
    ),
    "返回首页",
  );
}

function Breadcrumb({ title }) {
  return createElement("nav", { className: "pm-breadcrumb", "aria-label": "面包屑导航" },
    createElement("a", { href: "/" }, "首页"),
    createElement("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
      createElement("polyline", { points: "9 18 15 12 9 6" }),
    ),
    createElement("span", null, title),
  );
}

function StatusBadge({ status }) {
  const labelMap = { approved: "已通过", pending: "待审核", rejected: "已拒绝" };
  return createElement("span", { className: `pm-status-badge ${status}` }, labelMap[status] ?? status);
}

function StarIcon() {
  return createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("polygon", { points: "12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" }),
  );
}

function UsersIcon() {
  return createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("path", { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }),
    createElement("circle", { cx: "9", cy: "7", r: "4" }),
    createElement("path", { d: "M23 21v-2a4 4 0 0 0-3-3.87" }),
    createElement("path", { d: "M16 3.13a4 4 0 0 1 0 7.75" }),
  );
}

function HistoryIcon() {
  return createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
    createElement("polyline", { points: "22 12 18 12 15 21 9 3 6 12 2 12" }),
  );
}

/**
 * @param {{ detail: PromptDetailView }} props
 */
export function PromptDetailContent({ detail }) {
  const versions = sortVersionsDesc(detail.versions);
  const employeeCandidateCards = pickLatestCandidateByEmployee(versions);

  return createElement("main", { className: "prompt-detail-page", style: { maxWidth: "1200px", margin: "0 auto" } },
    createElement(BackButton),
    createElement(Breadcrumb, { title: detail.title }),
    createElement("div", { className: "pm-detail-header" },
      createElement("h1", { className: "pm-page-title", style: { margin: 0, fontSize: "24px" } }, detail.title),
      createElement("div", { className: "pm-detail-meta" },
        createElement("span", { className: "pm-pill" }, detail.category.name),
        createElement("span", { style: { color: "var(--pm-muted)", fontSize: "14px" } }, detail.summary),
      ),
    ),

    createElement("div", { className: "pm-cards-grid" },
      createElement("section", { "aria-label": "官方推荐", className: "pm-card pm-card--official", "data-testid": "official-card" },
        createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" } },
          createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "var(--pm-accent-light)", color: "var(--pm-accent)" } },
            createElement(StarIcon),
          ),
          createElement("div", null,
            createElement("h2", { style: { margin: 0, fontSize: "16px", color: "var(--pm-title)" } }, "官方推荐"),
            createElement("span", { style: { fontSize: "12px", color: "var(--pm-muted)" } }, `版本 ${detail.currentVersion.versionNo}`),
          ),
          createElement("div", { style: { marginLeft: "auto" } }, createElement(StatusBadge, { status: "approved" })),
        ),
        createElement("div", { className: "pm-code-block" }, detail.currentVersion.content),
        createElement("div", { style: { marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
          createElement(VersionLikeAction, {
            slug: detail.slug,
            versionNo: detail.currentVersion.versionNo,
            initialLikesCount: detail.currentVersion.likesCount ?? detail.likesCount ?? 0,
            initialLiked: detail.currentVersion.liked ?? false,
          }),
          createElement(CopyCardButton, { content: detail.currentVersion.content }),
        ),
      ),

      employeeCandidateCards.length > 0 ? employeeCandidateCards.map((card) =>
        createElement("article", {
          key: `${card.submittedBy}-${card.versionNo}`,
          className: "pm-card pm-card--candidate",
          "data-testid": "employee-candidate-card",
        },
          createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" } },
            createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#eff6ff", color: "#3b82f6" } },
              createElement(UsersIcon),
            ),
            createElement("div", { style: { flex: 1, minWidth: 0 } },
              createElement("h2", { style: { margin: 0, fontSize: "16px", color: "var(--pm-title)" } }, `${card.submittedBy} 的候选`),
              createElement("span", { style: { fontSize: "12px", color: "var(--pm-muted)" } }, `版本 ${card.versionNo}`),
            ),
            createElement(StatusBadge, { status: card.status }),
          ),
          createElement("div", { className: "pm-code-block" }, card.content ?? ""),
          createElement("div", { style: { marginTop: "12px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" } },
            createElement(VersionLikeAction, {
              slug: detail.slug,
              versionNo: card.versionNo,
              initialLikesCount: card.likesCount ?? 0,
              initialLiked: card.liked ?? false,
            }),
            createElement(CopyCardButton, { content: card.content ?? "" }),
          ),
        ),
      ) : createElement("article", { className: "pm-card pm-card--candidate" },
        createElement("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" } },
          createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#eff6ff", color: "#3b82f6" } },
            createElement(UsersIcon),
          ),
          createElement("h2", { style: { margin: 0, fontSize: "16px", color: "var(--pm-title)" } }, "员工候选卡"),
        ),
        createElement("div", {
          style: { textAlign: "center", padding: "32px 20px", color: "var(--pm-muted)", border: "1px dashed var(--pm-border)", borderRadius: "10px" },
        }, "暂无员工候选卡，点击下方提交你的候选版本"),
      ),
    ),

    createElement(PromptActions, {
      slug: detail.slug,
      currentVersionContent: detail.currentVersion.content,
    }),

    createElement("section", { "aria-label": "历史版本", className: "pm-detail-section" },
      createElement("h2", { style: { margin: "0 0 16px 0", fontSize: "18px", color: "var(--pm-title)", display: "flex", alignItems: "center", gap: "8px" } },
        createElement(HistoryIcon),
        "历史版本",
      ),
      createElement("div", { className: "pm-version-list" },
        ...versions.map((version) =>
          createElement("article", {
            key: version.versionNo,
            className: `pm-version-item ${version.versionNo === detail.currentVersion.versionNo ? "current" : ""}`,
          },
            createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" } },
              createElement("h3", { style: { margin: 0, fontSize: "15px", color: "var(--pm-title)" } },
                version.versionNo === detail.currentVersion.versionNo ? `${version.versionNo}（当前版本）` : version.versionNo,
              ),
              createElement(StatusBadge, { status: version.status }),
            ),
            version.status === "rejected"
              ? createElement("p", { style: { color: "var(--pm-muted)", fontStyle: "italic", margin: 0 } }, "该版本正文不可见")
              : createElement("div", { className: "pm-code-block" }, version.content ?? ""),
          ),
        ),
      ),
    ),
  );
}
