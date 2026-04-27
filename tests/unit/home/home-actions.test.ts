import test from "node:test";
import assert from "node:assert/strict";

import {
  HOME_ACTION_ENTRIES,
  HOME_ACTION_STATUS_TEXT,
} from "../../../apps/web/app/_home/home-actions.ts";

test("首页创建/导入/管理入口应为可直达链接", () => {
  assert.deepEqual(
    HOME_ACTION_ENTRIES.map((entry) => ({
      label: entry.label,
      href: entry.href,
    })),
    [
      { label: "导入", href: "/admin/import" },
      { label: "管理", href: "/admin" },
      { label: "创建", href: "/admin/create" },
    ],
  );
});

test("首页状态提示不应包含暂未实现占位文案", () => {
  assert.match(HOME_ACTION_STATUS_TEXT, /入口已开放/);
  assert.doesNotMatch(HOME_ACTION_STATUS_TEXT, /暂未实现/);
});
