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

export function PromptActions({ slug, initialLikesCount }) {
  const [likesCount, setLikesCount] = useState(initialLikesCount ?? 0);
  const [liked, setLiked] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
    ),
    errorMessage
      ? createElement("p", { role: "alert", style: { color: "#d1242f", margin: 0 } }, errorMessage)
      : null,
  );
}
