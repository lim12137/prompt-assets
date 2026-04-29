import test from "node:test";
import assert from "node:assert/strict";

import { resolveAdminRedirectTarget } from "../../../apps/web/lib/auth/admin-redirect.ts";

test("未登录访问 /admin/create 时应保留 deep-link", () => {
  const target = resolveAdminRedirectTarget(
    new Headers({
      "next-url": "http://127.0.0.1:3011/admin/create",
    }),
  );
  assert.equal(target, "/admin/create");
});

test("未登录访问 /admin/import 时应保留 deep-link", () => {
  const target = resolveAdminRedirectTarget(
    new Headers({
      "next-url": "http://127.0.0.1:3011/admin/import",
    }),
  );
  assert.equal(target, "/admin/import");
});

test("中间件传入 x-pathname 时应优先使用该路径", () => {
  const target = resolveAdminRedirectTarget(
    new Headers({
      "x-pathname": "/admin/create",
      "next-url": "http://127.0.0.1:3011/admin",
    }),
  );
  assert.equal(target, "/admin/create");
});
