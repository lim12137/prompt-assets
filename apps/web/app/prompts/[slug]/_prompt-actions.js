"use client";

import { createElement, useEffect, useState, useTransition } from "react";

const DEFAULT_ACTOR_EMAIL = "alice@example.com";
const DEFAULT_SCORE_SCENE = "detail_page";
const SCORE_CHOICES = [1, 2, 3, 4, 5];

async function mutateVersionLike(slug, versionNo, liked, actorEmail) {
  const method = liked ? "DELETE" : "POST";
  const response = await fetch(
    `/api/prompts/${encodeURIComponent(slug)}/versions/${encodeURIComponent(versionNo)}/like`,
    {
      method,
      headers: { "x-user-email": actorEmail },
    },
  );
  if (!response.ok) throw new Error("点赞操作失败");
  return response.json();
}

function normalizeScore(value) {
  if (!Number.isInteger(value)) return null;
  if (value < 1 || value > 5) return null;
  return value;
}

function normalizeScoreStats(payload) {
  const totalScores = Number(payload?.totalScores ?? 0);
  const averageScore = Number(payload?.averageScore ?? 0);
  const lowScoreRate = Number(payload?.lowScoreRate ?? 0);

  return {
    totalScores: Number.isFinite(totalScores) && totalScores > 0 ? totalScores : 0,
    averageScore: Number.isFinite(averageScore) ? averageScore : 0,
    lowScoreRate: Number.isFinite(lowScoreRate) ? lowScoreRate : 0,
  };
}

function createTraceId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `trace-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

export function formatScoreStatsSummary(stats) {
  const totalScores = Number(stats?.totalScores ?? 0);
  if (!Number.isFinite(totalScores) || totalScores <= 0) {
    return "暂无评分";
  }

  const averageScore = Number(stats?.averageScore ?? 0);
  const lowScoreRate = Number(stats?.lowScoreRate ?? 0);
  const lowScorePercent = Math.max(0, Math.min(100, Math.round(lowScoreRate * 100)));
  return `均分 ${averageScore.toFixed(2)} · ${totalScores} 人评分 · 低分率 ${lowScorePercent}%`;
}

export async function fetchVersionScoreStats(
  slug,
  versionNo,
  scene = DEFAULT_SCORE_SCENE,
) {
  const normalizedScene = String(scene ?? "").trim() || DEFAULT_SCORE_SCENE;
  const response = await fetch(
    `/api/prompts/${encodeURIComponent(slug)}/versions/${encodeURIComponent(versionNo)}/score-stats?scene=${encodeURIComponent(normalizedScene)}`,
    { method: "GET" },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("评分统计加载失败");
  }
  return normalizeScoreStats(payload);
}

export async function mutateVersionScore(
  slug,
  versionNo,
  { score, scene = DEFAULT_SCORE_SCENE, actorEmail = DEFAULT_ACTOR_EMAIL, traceId } = {},
) {
  const normalizedScore = normalizeScore(score);
  if (normalizedScore === null) {
    throw new Error("评分必须为 1-5 的整数");
  }

  const normalizedScene = String(scene ?? "").trim() || DEFAULT_SCORE_SCENE;
  const normalizedActor = String(actorEmail ?? "").trim();
  const response = await fetch(
    `/api/prompts/${encodeURIComponent(slug)}/versions/${encodeURIComponent(versionNo)}/score`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-user-email":
          normalizedActor && normalizedActor.includes("@")
            ? normalizedActor
            : DEFAULT_ACTOR_EMAIL,
      },
      body: JSON.stringify({
        score: normalizedScore,
        scene: normalizedScene,
        traceId:
          typeof traceId === "string" && traceId.trim().length > 0
            ? traceId.trim()
            : createTraceId(),
      }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error("评分提交失败");
  }
  return payload;
}

async function submitCandidate(slug, content, actorEmail) {
  const response = await fetch(`/api/prompts/${encodeURIComponent(slug)}/submissions`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-email": actorEmail },
    body: JSON.stringify({ content, changeNote: "员工候选迭代提交" }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" && payload.error.length > 0 ? payload.error : "候选提交失败");
  }
  return payload;
}

function LikeIcon({ filled }) {
  return createElement("svg", {
    width: "16", height: "16", viewBox: "0 0 24 24",
    fill: filled ? "currentColor" : "none", stroke: "currentColor", strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  }, createElement("path", { d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" }));
}

function ChevronIcon({ expanded }) {
  return createElement("svg", {
    width: "16", height: "16", viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
    style: { transition: "transform 0.2s ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" },
  }, createElement("polyline", { points: "6 9 12 15 18 9" }));
}

function Message({ type, children }) {
  const style = type === "success"
    ? { backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }
    : { backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fecaca" };
  return createElement("div", {
    role: type === "success" ? "status" : "alert",
    style: { ...style, padding: "10px 14px", borderRadius: "8px", fontSize: "14px", display: "flex", alignItems: "center", gap: "8px" },
  }, children);
}

function CopyIcon() {
  return createElement("svg", {
    width: "16", height: "16", viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  }, createElement("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }), createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }));
}

function SendIcon() {
  return createElement("svg", {
    width: "16", height: "16", viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  }, createElement("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), createElement("polygon", { points: "22 2 15 22 11 13 2 9 22 2" }));
}

function CheckIcon() {
  return createElement("svg", {
    width: "16", height: "16", viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  }, createElement("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }), createElement("polyline", { points: "22 4 12 14.01 9 11.01" }));
}

function AlertIcon() {
  return createElement("svg", {
    width: "16", height: "16", viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: "2",
    strokeLinecap: "round", strokeLinejoin: "round",
  }, createElement("circle", { cx: "12", cy: "12", r: "10" }), createElement("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), createElement("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" }));
}

export function VersionLikeAction({
  slug,
  versionNo,
  initialLikesCount,
  initialLiked,
  actorEmail = DEFAULT_ACTOR_EMAIL,
}) {
  const [likesCount, setLikesCount] = useState(Number(initialLikesCount ?? 0));
  const [liked, setLiked] = useState(Boolean(initialLiked));
  const [errorMessage, setErrorMessage] = useState("");
  const [isLikePending, startLikeTransition] = useTransition();
  const [isScorePending, startScoreTransition] = useTransition();
  const [scoreStats, setScoreStats] = useState({
    totalScores: 0,
    averageScore: 0,
    lowScoreRate: 0,
  });
  const [scoreStatusMessage, setScoreStatusMessage] = useState("");
  const [scoreErrorMessage, setScoreErrorMessage] = useState("");
  const [selectedScore, setSelectedScore] = useState(0);
  const [isScoreStatsLoading, setIsScoreStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsScoreStatsLoading(true);
    setScoreErrorMessage("");

    void fetchVersionScoreStats(slug, versionNo, DEFAULT_SCORE_SCENE)
      .then((stats) => {
        if (cancelled) return;
        setScoreStats(stats);
        setIsScoreStatsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setIsScoreStatsLoading(false);
        setScoreErrorMessage("评分统计加载失败");
      });

    return () => {
      cancelled = true;
    };
  }, [slug, versionNo]);

  const onToggleLike = () => {
    startLikeTransition(() => {
      setErrorMessage("");
      const normalizedActor = String(actorEmail ?? "").trim();
      void mutateVersionLike(
        slug,
        versionNo,
        liked,
        normalizedActor && normalizedActor.includes("@")
          ? normalizedActor
          : DEFAULT_ACTOR_EMAIL,
      )
        .then((payload) => {
          setLiked(Boolean(payload?.liked));
          setLikesCount(Number(payload?.likesCount ?? 0));
        })
        .catch(() => {
          setErrorMessage("点赞失败，请稍后重试");
        });
    });
  };

  const onSubmitScore = (score) => {
    startScoreTransition(() => {
      setScoreErrorMessage("");
      setScoreStatusMessage("评分提交中...");
      const normalizedActor = String(actorEmail ?? "").trim();

      void mutateVersionScore(slug, versionNo, {
        score,
        scene: DEFAULT_SCORE_SCENE,
        actorEmail:
          normalizedActor && normalizedActor.includes("@")
            ? normalizedActor
            : DEFAULT_ACTOR_EMAIL,
      })
        .then((payload) => {
          const submittedScore = Number(payload?.score ?? score);
          const nextSelectedScore = Number.isFinite(submittedScore)
            ? submittedScore
            : score;
          setSelectedScore(nextSelectedScore);
          setScoreStatusMessage(`评分已提交：${nextSelectedScore} 分`);
          return fetchVersionScoreStats(slug, versionNo, DEFAULT_SCORE_SCENE);
        })
        .then((stats) => {
          setScoreStats(stats);
        })
        .catch(() => {
          setScoreStatusMessage("");
          setScoreErrorMessage("评分失败，请稍后重试");
        });
    });
  };

  return createElement(
    "div",
    { style: { display: "grid", gap: "8px" } },
    createElement(
      "div",
      { style: { display: "inline-flex", alignItems: "center", gap: "8px" } },
      createElement(
        "button",
        {
          type: "button",
          onClick: onToggleLike,
          "aria-pressed": liked,
          disabled: isLikePending,
          className: liked ? "pm-primary-button" : "pm-secondary-button",
          style: { display: "inline-flex", alignItems: "center", gap: "6px" },
          "data-testid": "version-like-button",
        },
        createElement(LikeIcon, { filled: liked }),
        isLikePending ? "处理中..." : liked ? "取消点赞" : "点赞",
      ),
      createElement(
        "span",
        {
          style: { fontSize: "14px", color: "var(--pm-muted)", minWidth: "50px" },
          "data-testid": "version-like-count",
        },
        `${likesCount} 赞`,
      ),
    ),
    createElement(
      "div",
      { style: { display: "grid", gap: "6px" } },
      createElement(
        "div",
        { style: { display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
        ...SCORE_CHOICES.map((score) =>
          createElement(
            "button",
            {
              key: `score-${score}`,
              type: "button",
              onClick: () => onSubmitScore(score),
              disabled: isScorePending,
              className:
                selectedScore === score
                  ? "pm-primary-button"
                  : "pm-secondary-button",
              style: { minWidth: "42px", padding: "4px 8px", fontSize: "13px" },
              "data-testid": `version-score-button-${score}`,
              "aria-label": `评分 ${score} 分`,
            },
            `${score}分`,
          ),
        ),
      ),
      createElement(
        "span",
        {
          style: { fontSize: "13px", color: "var(--pm-muted)" },
          "data-testid": "version-score-stats",
        },
        isScoreStatsLoading
          ? "评分统计加载中..."
          : formatScoreStatsSummary(scoreStats),
      ),
      scoreStatusMessage
        ? createElement(
            "span",
            {
              style: { fontSize: "13px", color: "var(--pm-muted)" },
              "data-testid": "version-score-status",
            },
            scoreStatusMessage,
          )
        : null,
      scoreErrorMessage
        ? createElement(
            "span",
            {
              style: { fontSize: "13px", color: "#b91c1c" },
              "data-testid": "version-score-error",
            },
            scoreErrorMessage,
          )
        : null,
    ),
    errorMessage
      ? createElement(
          "span",
          { style: { fontSize: "13px", color: "#b91c1c" } },
          errorMessage,
        )
      : null,
  );
}

export function PromptActions({ slug, currentVersionContent }) {
  const [actorEmail, setActorEmail] = useState(DEFAULT_ACTOR_EMAIL);
  const [copyStatusMessage, setCopyStatusMessage] = useState("");
  const [copyErrorMessage, setCopyErrorMessage] = useState("");

  const [candidateExpanded, setCandidateExpanded] = useState(false);
  const [candidateContent, setCandidateContent] = useState("");
  const [candidateStatusMessage, setCandidateStatusMessage] = useState("");
  const [candidateErrorMessage, setCandidateErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const copyCurrentVersion = () => {
    setCopyStatusMessage(""); setCopyErrorMessage("");
    const content = String(currentVersionContent ?? "");
    if (!content) { setCopyErrorMessage("复制失败，当前版本正文为空"); return; }
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) { setCopyErrorMessage("复制失败，请手动复制"); return; }
    void clipboard.writeText(content)
      .then(() => { setCopyStatusMessage("复制成功：已复制当前版本正文"); })
      .catch(() => { setCopyErrorMessage("复制失败，请稍后重试"); });
  };

  const onSubmitCandidate = () => {
    startTransition(() => {
      setCandidateStatusMessage(""); setCandidateErrorMessage("");
      const content = candidateContent.trim();
      if (!content) { setCandidateErrorMessage("候选内容不能为空"); return; }
      const currentActorEmail = actorEmail.trim();
      if (!currentActorEmail || !currentActorEmail.includes("@")) { setCandidateErrorMessage("当前员工邮箱无效"); return; }

      setCandidateStatusMessage("提交中...");
      void submitCandidate(slug, content, currentActorEmail)
        .then((payload) => {
          const candidateNo = payload?.candidateVersion?.candidateNo;
          setCandidateStatusMessage(typeof candidateNo === "string" && candidateNo.length > 0 ? `提交成功：${candidateNo}` : "提交成功");
          setCandidateContent("");
        })
        .catch((error) => {
          setCandidateErrorMessage(`提交失败：${error instanceof Error ? error.message : "候选提交失败"}`);
        });
    });
  };

  return createElement("div", { style: { display: "grid", gap: "12px" } },
    createElement("div", { className: "pm-detail-section" },
      createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" } },
        createElement("label", { style: { display: "flex", alignItems: "center", gap: "8px", flex: "1 1 280px" } },
          createElement("span", { style: { fontSize: "14px", color: "var(--pm-muted)", whiteSpace: "nowrap" } }, "员工邮箱"),
          createElement("input", {
            value: actorEmail, onChange: (e) => setActorEmail(e.target.value),
            style: { flex: 1, padding: "8px 12px", border: "1px solid var(--pm-border)", borderRadius: "8px", fontSize: "14px", outline: "none", transition: "border-color 0.2s ease, box-shadow 0.2s ease" },
            onFocus: (e) => { e.target.style.borderColor = "var(--pm-accent)"; e.target.style.boxShadow = "0 0 0 3px rgba(196, 30, 58, 0.15)"; },
            onBlur: (e) => { e.target.style.borderColor = "var(--pm-border)"; e.target.style.boxShadow = "none"; },
          }),
        ),
        createElement("div", { style: { display: "flex", gap: "8px", alignItems: "center" } },
          createElement("button", {
            type: "button", onClick: copyCurrentVersion, className: "pm-secondary-button",
            style: { display: "inline-flex", alignItems: "center", gap: "6px" },
          }, createElement(CopyIcon), "复制当前版本"),
        ),
      ),
      createElement("div", { style: { display: "grid", gap: "8px", marginTop: "10px" } },
        copyStatusMessage ? createElement(Message, { type: "success" }, createElement(CheckIcon), copyStatusMessage) : null,
        copyErrorMessage ? createElement(Message, { type: "error" }, createElement(AlertIcon), copyErrorMessage) : null,
      ),
    ),

    createElement("div", { className: "pm-detail-section", style: { padding: "0", overflow: "hidden" } },
      createElement("button", {
        type: "button",
        onClick: () => setCandidateExpanded((v) => !v),
        style: {
          width: "100%", padding: "14px 20px", border: "none", background: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", fontSize: "15px", fontWeight: 500, color: "var(--pm-title)",
          fontFamily: "inherit",
        },
      },
        createElement("span", { style: { display: "flex", alignItems: "center", gap: "8px" } },
          createElement("svg", { width: "18", height: "18", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" },
            createElement("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }),
            createElement("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" }),
          ),
          "提交候选迭代",
        ),
        createElement(ChevronIcon, { expanded: candidateExpanded }),
      ),
      candidateExpanded ? createElement("div", { style: { padding: "0 20px 20px 20px", borderTop: "1px solid var(--pm-border)" } },
        createElement("div", { style: { paddingTop: "16px", display: "grid", gap: "12px" } },
          createElement("label", { style: { display: "grid", gap: "8px" } },
            createElement("span", { style: { fontSize: "14px", color: "var(--pm-muted)" } }, "候选内容"),
            createElement("textarea", {
              value: candidateContent, rows: 6,
              onChange: (e) => setCandidateContent(e.target.value),
              placeholder: "在此输入你的候选提示词内容...",
              style: { padding: "12px", border: "1px solid var(--pm-border)", borderRadius: "8px", fontSize: "14px", fontFamily: "inherit", resize: "vertical", outline: "none", transition: "border-color 0.2s ease, box-shadow 0.2s ease" },
              onFocus: (e) => { e.target.style.borderColor = "var(--pm-accent)"; e.target.style.boxShadow = "0 0 0 3px rgba(196, 30, 58, 0.15)"; },
              onBlur: (e) => { e.target.style.borderColor = "var(--pm-border)"; e.target.style.boxShadow = "none"; },
            }),
          ),
          createElement("div", { style: { display: "flex", alignItems: "center", gap: "8px" } },
            createElement("button", {
              type: "button", className: "pm-primary-button", onClick: onSubmitCandidate, disabled: isPending,
              style: { display: "inline-flex", alignItems: "center", gap: "6px" },
            }, isPending
              ? createElement("span", { style: { display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" } })
              : createElement(SendIcon),
              isPending ? "提交中..." : "提交候选"),
          ),
          createElement("div", { style: { display: "grid", gap: "8px" } },
            candidateStatusMessage ? createElement(Message, { type: "success" }, createElement(CheckIcon), candidateStatusMessage) : null,
            candidateErrorMessage ? createElement(Message, { type: "error" }, createElement(AlertIcon), candidateErrorMessage) : null,
          ),
        ),
      ) : null,
    ),
  );
}
