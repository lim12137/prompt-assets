"use client";

import { createElement, useState } from "react";

export function CopyCardButton({ content }) {
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onCopy = () => {
    setStatusMessage("");
    setErrorMessage("");

    const text = String(content ?? "");
    if (!text) {
      setErrorMessage("复制失败，卡片内容为空");
      return;
    }

    const clipboard = globalThis.navigator?.clipboard;
    if (!clipboard?.writeText) {
      setErrorMessage("复制失败，请手动复制");
      return;
    }

    void clipboard
      .writeText(text)
      .then(() => {
        setStatusMessage("复制成功");
      })
      .catch(() => {
        setErrorMessage("复制失败，请稍后重试");
      });
  };

  return createElement(
    "div",
    { style: { display: "grid", gap: "6px" } },
    createElement(
      "button",
      {
        type: "button",
        className: "pm-primary-button",
        onClick: onCopy,
      },
      "复制此卡内容",
    ),
    statusMessage
      ? createElement("p", { role: "status", style: { margin: 0, color: "#0f7b0f" } }, statusMessage)
      : null,
    errorMessage
      ? createElement("p", { role: "alert", style: { margin: 0, color: "#d1242f" } }, errorMessage)
      : null,
  );
}
