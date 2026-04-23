"use client";

import { createElement, useState, useTransition } from "react";

const ACTOR_EMAIL = "alice@example.com";

async function mutateLike(slug, liked) {
  const method = liked ? "DELETE" : "POST";
  const response = await fetch(`/api/prompts/${encodeURIComponent(slug)}/like`, {
    method,
    headers: {
      "x-user-email": ACTOR_EMAIL,
    },
  });

  if (!response.ok) {
    throw new Error("点赞操作失败");
  }

  return response.json();
}

export function PromptActions({ slug, initialLikesCount, currentVersionContent }) {
  const [likesCount, setLikesCount] = useState(initialLikesCount ?? 0);
  const [liked, setLiked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copyStatusMessage, setCopyStatusMessage] = useState("");
  const [copyErrorMessage, setCopyErrorMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const onToggleLike = () => {
    startTransition(() => {
      setErrorMessage("");
      void mutateLike(slug, liked)
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

  return createElement(
    "section",
    { "aria-label": "互动操作", style: { display: "grid", gap: "6px" } },
    createElement(
      "div",
      { style: { display: "flex", gap: "8px", alignItems: "center" } },
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
    copyStatusMessage
      ? createElement("p", { role: "status", style: { color: "#0f7b0f", margin: 0 } }, copyStatusMessage)
      : null,
    errorMessage
      ? createElement("p", { role: "alert", style: { color: "#d1242f", margin: 0 } }, errorMessage)
      : null,
    copyErrorMessage
      ? createElement("p", { role: "alert", style: { color: "#d1242f", margin: 0 } }, copyErrorMessage)
      : null,
  );
}
