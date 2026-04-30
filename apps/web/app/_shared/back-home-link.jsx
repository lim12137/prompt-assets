import { createElement } from "react";

export function BackHomeLink() {
  return createElement(
    "a",
    { href: "/", className: "pm-back-button", "aria-label": "返回首页" },
    createElement(
      "svg",
      {
        width: "16",
        height: "16",
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "2",
        strokeLinecap: "round",
        strokeLinejoin: "round",
      },
      createElement("polyline", { points: "15 18 9 12 15 6" }),
    ),
    "返回首页",
  );
}
