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
        setTimeout(() => setStatusMessage(""), 2000);
      })
      .catch(() => {
        setErrorMessage("复制失败，请稍后重试");
      });
  };

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "6px" } },
    createElement(
      "button",
      {
        type: "button",
        className: "pm-secondary-button",
        onClick: onCopy,
        style: { display: "inline-flex", alignItems: "center", gap: "6px", width: "fit-content" },
      },
      createElement(
        "svg",
        {
          width: "14",
          height: "14",
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: "2",
          strokeLinecap: "round",
          strokeLinejoin: "round",
        },
        createElement("rect", { x: "9", y: "9", width: "13", height: "13", rx: "2", ry: "2" }),
        createElement("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }),
      ),
      "复制此卡内容",
    ),
    statusMessage
      ? createElement(
          "span",
          {
            role: "status",
            style: {
              fontSize: "13px",
              color: "#15803d",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            },
          },
          createElement(
            "svg",
            {
              width: "14",
              height: "14",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            },
            createElement("polyline", { points: "20 6 9 17 4 12" }),
          ),
          statusMessage,
        )
      : null,
    errorMessage
      ? createElement(
          "span",
          {
            role: "alert",
            style: {
              fontSize: "13px",
              color: "#b91c1c",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            },
          },
          createElement(
            "svg",
            {
              width: "14",
              height: "14",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
            },
            createElement("circle", { cx: "12", cy: "12", r: "10" }),
            createElement("line", { x1: "12", y1: "8", x2: "12", y2: "12" }),
            createElement("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" }),
          ),
          errorMessage,
        )
      : null,
  );
}
