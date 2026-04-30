import test from "node:test";
import assert from "node:assert/strict";

import { buildLoginHref } from "../../../apps/web/lib/auth/login-link.ts";

test("未登录跳转链接保留当前路径", () => {
  assert.equal(
    buildLoginHref("/prompts/js-code-reviewer"),
    "/login?redirect=%2Fprompts%2Fjs-code-reviewer",
  );
});

test("无效路径回落 /login", () => {
  assert.equal(buildLoginHref(undefined), "/login");
  assert.equal(buildLoginHref("/login"), "/login");
  assert.equal(buildLoginHref("javascript:alert(1)"), "/login");
});
