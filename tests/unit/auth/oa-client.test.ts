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
      return new Response('{"name":"Alice"}', { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await authenticateWithOa({ username: "alice", password: "p" });
    assert.equal(result.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].cookie, "oa_session=abc123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
