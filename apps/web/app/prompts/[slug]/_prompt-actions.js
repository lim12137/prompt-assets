"use client";

import { createElement, useState, useTransition } from "react";

const DEFAULT_ACTOR_EMAIL = "alice@example.com";

async function mutateLike(slug, liked, actorEmail) {
  const method = liked ? "DELETE" : "POST";
  const response = await fetch(`/api/prompts/${encodeURIComponent(slug)}/like`, {
    method,
    headers: {
      "x-user-email": actorEmail,
    },
  });

  if (!response.ok) {
    throw new Error("点赞操作失败");
  }

  return response.json();
}

async function submitCandidate(slug, content, actorEmail) {
  const response = await fetch(`/api/prompts/${encodeURIComponent(slug)}/submissions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-email": actorEmail,
    },
    body: JSON.stringify({
      content,
      changeNote: "员工候选迭代提交",
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" && payload.error.length > 0
        ? payload.error
        : "候选提交失败",
    );
  }
  return payload;
}

export function PromptActions({ slug, initialLikesCount, currentVersionContent }) {
  const [actorEmail, setActorEmail] = useState(DEFAULT_ACTOR_EMAIL);
  const [likesCount, setLikesCount] = useState(initialLikesCount ?? 0);
  const [liked, setLiked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copyStatusMessage, setCopyStatusMessage] = useState("");
  const [copyErrorMessage, setCopyErrorMessage] = useState("");
  const [candidateContent, setCandidateContent] = useState("");
  const [candidateStatusMessage, setCandidateStatusMessage] = useState("");
  const [candidateErrorMessage, setCandidateErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const onToggleLike = () => {
    startTransition(() => {
      setErrorMessage("");
      void mutateLike(slug, liked, actorEmail.trim())
        .then((payload) => {
          setLiked(Boolean(payload?.liked));
          setLikesCount(Number(payload?.likesCount ?? 0));
        })
        .catch(() => {
          setErrorMessage("点赞失败，请稍后重试");
        });
    });
  };

  const copyCurrentVersion = () => {
    setCopyStatusMessage("");
    setCopyErrorMessage("");
    const content = String(currentVersionContent ?? "");
    if (!content) {
      setCopyErrorMessage("复制失败，当前版本正文为空");
      return;
    }

    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) {
      setCopyErrorMessage("复制失败，请手动复制");
      return;
    }

    void clipboard
      .writeText(content)
      .then(() => {
        setCopyStatusMessage("复制成功：已复制当前版本正文");
      })
      .catch(() => {
        setCopyErrorMessage("复制失败，请稍后重试");
      });
  };

  const onSubmitCandidate = () => {
    startTransition(() => {
      setCandidateStatusMessage("");
      setCandidateErrorMessage("");

      const content = candidateContent.trim();
      if (!content) {
        setCandidateErrorMessage("候选内容不能为空");
        return;
      }
      const currentActorEmail = actorEmail.trim();
      if (!currentActorEmail || !currentActorEmail.includes("@")) {
        setCandidateErrorMessage("当前员工邮箱无效");
        return;
      }

      setCandidateStatusMessage("候选提交中...");
      void submitCandidate(slug, content, currentActorEmail)
        .then((payload) => {
          const candidateNo = payload?.candidateVersion?.candidateNo;
          setCandidateStatusMessage(
            typeof candidateNo === "string" && candidateNo.length > 0
              ? `提交成功：${candidateNo}`
              : "提交成功",
          );
          setCandidateContent("");
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "候选提交失败";
          setCandidateErrorMessage(`提交失败：${message}`);
        });
    });
  };

  return createElement(
    "section",
    { "aria-label": "互动操作", style: { display: "grid", gap: "10px" } },
    createElement(
      "div",
      { style: { display: "flex", gap: "8px", alignItems: "center" } },
      createElement(
        "label",
        { style: { display: "flex", alignItems: "center", gap: "6px" } },
        createElement("span", null, "当前员工邮箱"),
        createElement("input", {
          value: actorEmail,
          onChange: (event) => setActorEmail(event.target.value),
        }),
      ),
      createElement(
        "button",
        {
          type: "button",
          onClick: onToggleLike,
          "aria-pressed": liked,
          disabled: isPending,
        },
        isPending ? "处理中..." : liked ? "取消点赞" : "点赞",
      ),
      createElement("span", null, `点赞数：${likesCount}`),
      createElement(
        "button",
        {
          type: "button",
          onClick: copyCurrentVersion,
          className: "pm-primary-button",
        },
        "复制当前版本",
      ),
    ),
    createElement(
      "section",
      {
        "aria-label": "候选迭代提交",
        style: {
          display: "grid",
          gap: "8px",
          padding: "12px",
          border: "1px solid var(--pm-border)",
          borderRadius: "10px",
          background: "var(--pm-surface-soft)",
        },
      },
      createElement("h2", { style: { margin: 0, fontSize: "16px" } }, "提交候选迭代"),
      createElement(
        "label",
        { style: { display: "grid", gap: "6px" } },
        createElement("span", null, "候选内容"),
        createElement("textarea", {
          value: candidateContent,
          rows: 6,
          onChange: (event) => setCandidateContent(event.target.value),
        }),
      ),
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        createElement(
          "button",
          {
            type: "button",
            className: "pm-primary-button",
            onClick: onSubmitCandidate,
            disabled: isPending,
          },
          isPending ? "提交中..." : "提交候选迭代",
        ),
      ),
    ),
    candidateStatusMessage
      ? createElement("p", { role: "status", style: { color: "#0f7b0f", margin: 0 } }, candidateStatusMessage)
      : null,
    copyStatusMessage
      ? createElement("p", { role: "status", style: { color: "#0f7b0f", margin: 0 } }, copyStatusMessage)
      : null,
    errorMessage
      ? createElement("p", { role: "alert", style: { color: "#d1242f", margin: 0 } }, errorMessage)
      : null,
    copyErrorMessage
      ? createElement("p", { role: "alert", style: { color: "#d1242f", margin: 0 } }, copyErrorMessage)
      : null,
    candidateErrorMessage
      ? createElement("p", { role: "alert", style: { color: "#d1242f", margin: 0 } }, candidateErrorMessage)
      : null,
  );
}
