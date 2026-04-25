"use client";

import { createElement, useState, useTransition } from "react";

const DEFAULT_ACTOR_EMAIL = "alice@example.com";

async function mutateLike(slug, liked, actorEmail) {
  const method = liked ? "DELETE" : "POST";
  const response = await fetch(`/api/prompts/${encodeURIComponent(slug)}/like`, {
    method,
    headers: { "x-user-email": actorEmail },
  });
  if (!response.ok) throw new Error("点赞操作失败");
  return response.json();
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

export function PromptActions({ slug, initialLikesCount, currentVersionContent }) {
  const [actorEmail, setActorEmail] = useState(DEFAULT_ACTOR_EMAIL);
  const [likesCount, setLikesCount] = useState(initialLikesCount ?? 0);
  const [liked, setLiked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copyStatusMessage, setCopyStatusMessage] = useState("");
  const [copyErrorMessage, setCopyErrorMessage] = useState("");

  const [candidateExpanded, setCandidateExpanded] = useState(false);
  const [candidateContent, setCandidateContent] = useState("");
  const [candidateStatusMessage, setCandidateStatusMessage] = useState("");
  const [candidateErrorMessage, setCandidateErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const onToggleLike = () => {
    startTransition(() => {
      setErrorMessage("");
      void mutateLike(slug, liked, actorEmail.trim())
        .then((payload) => { setLiked(Boolean(payload?.liked)); setLikesCount(Number(payload?.likesCount ?? 0)); })
        .catch(() => { setErrorMessage("点赞失败，请稍后重试"); });
    });
  };

  const copyCurrentVersion = () => {
    setCopyStatusMessage(""); setCopyErrorMessage("");
    const content = String(currentVersionContent ?? "");
    if (!content) { setCopyErrorMessage("复制失败，当前版本正文为空"); return; }
    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) { setCopyErrorMessage("复制失败，请手动复制"); return; }
    void clipboard.writeText(content)
      .then(() => { setCopyStatusMessage("已复制当前版本正文"); })
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
            type: "button", onClick: onToggleLike, "aria-pressed": liked, disabled: isPending,
            className: liked ? "pm-primary-button" : "pm-secondary-button",
            style: { display: "inline-flex", alignItems: "center", gap: "6px" },
          }, createElement(LikeIcon, { filled: liked }), isPending ? "处理中..." : liked ? "取消点赞" : "点赞"),
          createElement("span", { style: { fontSize: "14px", color: "var(--pm-muted)", minWidth: "50px" } }, `${likesCount} 赞`),
          createElement("button", {
            type: "button", onClick: copyCurrentVersion, className: "pm-secondary-button",
            style: { display: "inline-flex", alignItems: "center", gap: "6px" },
          }, createElement(CopyIcon), "复制当前版本"),
        ),
      ),
      createElement("div", { style: { display: "grid", gap: "8px", marginTop: "10px" } },
        copyStatusMessage ? createElement(Message, { type: "success" }, createElement(CheckIcon), copyStatusMessage) : null,
        copyErrorMessage ? createElement(Message, { type: "error" }, createElement(AlertIcon), copyErrorMessage) : null,
        errorMessage ? createElement(Message, { type: "error" }, createElement(AlertIcon), errorMessage) : null,
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
