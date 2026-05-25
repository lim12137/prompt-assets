import test from "node:test";
import assert from "node:assert/strict";

import { resolveHomePagePromptLoadError } from "../../../apps/web/app/home-page-load-state.ts";

test("首页在数据库不可读时进入空白调试态且不再输出控制台错误", () => {
  const result = resolveHomePagePromptLoadError(
    new Error(
      "listPrompts requires a readable database in auto mode. Refusing to fallback to fixture prompts because it can surface initial seeded data unexpectedly.",
    ),
  );

  assert.deepEqual(result, {
    shouldRethrow: false,
    loadNotice: "首页当前无法读取真实数据库，已切换为空白调试态。",
    logToConsole: false,
  });
});

test("首页遇到非预期错误时继续抛出", () => {
  const result = resolveHomePagePromptLoadError(new Error("unexpected failure"));

  assert.deepEqual(result, {
    shouldRethrow: true,
    logToConsole: false,
  });
});
