import test from "node:test";
import assert from "node:assert/strict";

import { POST as loginPost } from "../../../apps/web/app/api/login/route.ts";
import { GET as meGet } from "../../../apps/web/app/api/me/route.ts";
import { POST as logoutPost } from "../../../apps/web/app/api/logout/route.ts";
import { POST as createPromptPost } from "../../../apps/web/app/api/prompts/route.ts";
import { __resetPromptLikeFixtureStateForTests } from "../../../apps/web/lib/api/prompt-repository.ts";
import { __setOaClientForTests } from "../../../apps/web/lib/auth/oa-client.ts";

function extractSetCookie(response: Response): string {
  return response.headers.get("set-cookie") ?? "";
}

test.beforeEach(() => {
  process.env.PROMPT_REPOSITORY_DATA_SOURCE = "fixture";
  process.env.LOGIN_TOKEN_SECRET = "integration-secret";
  process.env.ALLOW_ALL_LOGIN_USERS_MANAGE = "true";
  __resetPromptLikeFixtureStateForTests();
  __setOaClientForTests(async ({ username }) => {
    if (username === "alice") {
      return { ok: true, userInfo: { id: "u1001", name: "Alice" } };
    }
    return { ok: false, message: "invalid credentials" };
  });
});

test.afterEach(() => {
  delete process.env.PROMPT_REPOSITORY_DATA_SOURCE;
  delete process.env.LOGIN_TOKEN_SECRET;
  delete process.env.ALLOW_ALL_LOGIN_USERS_MANAGE;
  __setOaClientForTests(null);
});

test("POST /api/login + GET /api/me + POST /api/logout 基本链路", async () => {
  const loginResponse = await loginPost(
    new Request("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "123456" }),
    }),
  );
  assert.equal(loginResponse.status, 200);
  const setCookie = extractSetCookie(loginResponse);
  assert.match(setCookie, /auth_token=/);

  const meResponse = await meGet(
    new Request("http://localhost:3000/api/me", {
      method: "GET",
      headers: { cookie: setCookie.split(";")[0] ?? "" },
    }),
  );
  assert.equal(meResponse.status, 200);
  const mePayload = (await meResponse.json()) as { user: { uid: string } };
  assert.equal(mePayload.user.uid, "u1001");

  const logoutResponse = await logoutPost(
    new Request("http://localhost:3000/api/logout", {
      method: "POST",
      headers: { cookie: setCookie.split(";")[0] ?? "" },
    }),
  );
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /Max-Age=0/i);
});

test("POST /api/prompts 仅依赖 cookie 中的管理权限", async () => {
  const loginResponse = await loginPost(
    new Request("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "123456" }),
    }),
  );
  const setCookie = extractSetCookie(loginResponse);

  const createResponse = await createPromptPost(
    new Request("http://localhost:3000/api/prompts", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: setCookie.split(";")[0] ?? "",
      },
      body: JSON.stringify({
        title: "cookie admin create",
        summary: "cookie auth only",
        content: "hello",
      }),
    }),
  );

  assert.equal(createResponse.status, 201);
});

test("POST /api/login 在 LOGIN_TOKEN_SECRET 缺失时返回 500 配置错误", async () => {
  delete process.env.LOGIN_TOKEN_SECRET;
  const response = await loginPost(
    new Request("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "123456" }),
    }),
  );
  const payload = (await response.json()) as { code?: string };
  assert.equal(response.status, 500);
  assert.equal(payload.code, "auth_configuration_error");
});
