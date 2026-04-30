import test from "node:test";
import assert from "node:assert/strict";

import { authenticateWithOa, __setOaClientForTests } from "../../../apps/web/lib/auth/oa-client.ts";

test.afterEach(() => {
  __setOaClientForTests(null);
  delete process.env.AWS_PORTAL_URL;
});

test("authenticateWithOa: 第二次请求应带上第一次响应的 cookie", async () => {
  process.env.AWS_PORTAL_URL = "http://oa.local";
  const calls: Array<{ url: string; cookie: string | null }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const cookieHeader =
      init?.headers && typeof init.headers === "object" && "cookie" in init.headers
        ? String((init.headers as Record<string, string>).cookie)
        : null;
    calls.push({ url, cookie: cookieHeader });
    if (url.endsWith("/portal/r/jd")) {
      return new Response("ok", {
        status: 200,
        headers: { "set-cookie": "oa_session=abc123; Path=/; HttpOnly" },
      });
    }
    if (url.endsWith("/portal/r/w")) {
      return new Response('{"name":"Alice","department":"安全部"}', { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await authenticateWithOa({ username: "alice", password: "p" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.userInfo.name, "Alice");
      assert.equal(result.userInfo.department, "安全部");
    }
    assert.equal(calls.length, 2);
    assert.equal(calls[1].cookie, "oa_session=abc123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authenticateWithOa: 部门字段支持兼容解析（dept/org/部门）", async () => {
  process.env.AWS_PORTAL_URL = "http://oa.local";
  const originalFetch = globalThis.fetch;
  const payloads = ['{"name":"Alice","dept":"研发部"}', '{"name":"Bob","org":"产品部"}', '{"name":"Carol","部门":"安全部"}'];
  let index = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/portal/r/jd")) {
      return new Response("ok", {
        status: 200,
        headers: { "set-cookie": "oa_session=abc123; Path=/; HttpOnly" },
      });
    }
    if (url.endsWith("/portal/r/w")) {
      const payload = payloads[index] ?? payloads[payloads.length - 1];
      index += 1;
      return new Response(payload, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const one = await authenticateWithOa({ username: "alice", password: "p" });
    const two = await authenticateWithOa({ username: "bob", password: "p" });
    const three = await authenticateWithOa({ username: "carol", password: "p" });
    assert.equal(one.ok, true);
    assert.equal(two.ok, true);
    assert.equal(three.ok, true);
    if (one.ok && two.ok && three.ok) {
      assert.equal(one.userInfo.department, "研发部");
      assert.equal(two.userInfo.department, "产品部");
      assert.equal(three.userInfo.department, "安全部");
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("authenticateWithOa: HTML 含 meta viewport 时不应将 viewport 解析为姓名", async () => {
  process.env.AWS_PORTAL_URL = "http://oa.local";
  const originalFetch = globalThis.fetch;
  const profileHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
  </head>
  <body>
    <div>姓名: 张三</div>
    <div>部门: 安全部</div>
  </body>
</html>`;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/portal/r/jd")) {
      return new Response("ok", {
        status: 200,
        headers: { "set-cookie": "oa_session=abc123; Path=/; HttpOnly" },
      });
    }
    if (url.endsWith("/portal/r/w")) {
      return new Response(profileHtml, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await authenticateWithOa({ username: "zhangsan", password: "p" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.userInfo.name, "张三");
      assert.equal(result.userInfo.department, "安全部");
      assert.notEqual(result.userInfo.name, 'viewport"');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});
