import test from "node:test";
import assert from "node:assert/strict";

import { POST as logoutAllPost } from "../../apps/web/app/api/auth/sso/logout-all/route.ts";
import { signLoginToken } from "../../apps/web/lib/auth/session.ts";
import { getSsoSessionCookieName } from "../../apps/web/lib/auth/sso/cookies.ts";
import {
  __resetDefaultSessionTokenStoreForTests,
  saveSsoTokensForSession,
} from "../../apps/web/lib/auth/sso/session-token-store.ts";

const SSO_ENV_KEYS = [
  "AGENT_UI_SSO_ENABLED",
  "AGENT_UI_SSO_CLIENT_ID",
  "AGENT_UI_SSO_CLIENT_SECRET",
  "AGENT_UI_SSO_REDIRECT_URI",
  "AGENT_UI_SSO_SSO_ORIGIN",
  "AGENT_UI_SSO_AUTHORIZE_URL",
  "AGENT_UI_SSO_TOKEN_URL",
  "AGENT_UI_SSO_PROFILE_URL",
  "AGENT_UI_SSO_JWKS_URL",
  "AGENT_UI_SSO_ISSUER",
  "AGENT_UI_SSO_LOGOUT_URL",
  "AGENT_UI_FRONTEND_BASE_URL",
  "LOGIN_TOKEN_SECRET",
  "WHITELIST_ENABLED",
];

function fullEnabledEnv(): Record<string, string> {
  return {
    AGENT_UI_SSO_ENABLED: "true",
    AGENT_UI_SSO_CLIENT_ID: "cid",
    AGENT_UI_SSO_CLIENT_SECRET: "test-secret-do-not-use-in-prod",
    AGENT_UI_SSO_REDIRECT_URI: "http://app/api/auth/sso/callback",
    AGENT_UI_SSO_SSO_ORIGIN: "http://sso:19210",
    AGENT_UI_SSO_AUTHORIZE_URL: "http://sso:19210/auth/oauth2/authorize",
    AGENT_UI_SSO_TOKEN_URL: "http://sso:19210/auth/oauth2/token",
    AGENT_UI_SSO_PROFILE_URL: "http://sso:19210/system/user/getInfo",
    AGENT_UI_SSO_JWKS_URL: "http://sso:19210/auth/oauth2/jwks",
    AGENT_UI_SSO_ISSUER: "http://sso:19210/auth",
    AGENT_UI_SSO_LOGOUT_URL: "http://sso:19210/auth/oauth2/session/logout/all",
    AGENT_UI_FRONTEND_BASE_URL: "http://app",
    LOGIN_TOKEN_SECRET: "logout-integration-secret",
    WHITELIST_ENABLED: "false",
  };
}

function setEnv(env: Record<string, string>): void {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }
}

function clearEnv(): void {
  for (const key of SSO_ENV_KEYS) {
    delete process.env[key];
  }
}

/** 造一个有效登录态的请求（带 auth_token + sso_session_id cookie） */
function makeAuthenticatedRequest(sessionId: string): Request {
  const token = signLoginToken({
    uid: "u1",
    name: "Alice",
    can_manage: false,
    can_manage_whitelist: false,
  });
  const cookieName = getSsoSessionCookieName();
  return new Request("http://app/api/auth/sso/logout-all", {
    method: "POST",
    headers: { cookie: `auth_token=${token}; ${cookieName}=${sessionId}` },
  });
}

test.beforeEach(() => {
  clearEnv();
  __resetDefaultSessionTokenStoreForTests();
});

test.afterEach(() => {
  clearEnv();
  __resetDefaultSessionTokenStoreForTests();
});

test("logout-all: 无 session → 401 no_session（playbook 13.12：不让前端误判成功）", async () => {
  setEnv(fullEnabledEnv());
  const response = await logoutAllPost(
    new Request("http://app/api/auth/sso/logout-all", { method: "POST" }),
  );
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.code, "no_session");
});

test("logout-all: 有 session + SSO tokens → 200，清 cookie，代发 Bearer 到 SSO logout", async () => {
  setEnv(fullEnabledEnv());
  const sessionId = "sess-123";
  saveSsoTokensForSession(sessionId, {
    accessToken: "at-to-revoke",
    refreshToken: "rt-to-revoke",
  });

  let receivedUrl: string | null = null;
  let receivedAuth: string | null = null;
  let receivedMethod: string | null = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    receivedUrl = String(input);
    receivedMethod = init?.method ?? null;
    receivedAuth = init?.headers?.authorization ?? null;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;

  let response: Response;
  try {
    response = await logoutAllPost(makeAuthenticatedRequest(sessionId));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.ssoLogoutBackendOk, true);
  assert.equal(body.ssoLogoutUrl, "/auth/oauth2/session/logout/all");

  // 断言代发 Bearer（access_token 来自 session-token-store）
  assert.equal(receivedMethod, "POST");
  assert.ok(receivedUrl?.includes("/auth/oauth2/session/logout/all"));
  assert.equal(receivedAuth, "Bearer at-to-revoke");

  // 清了两个 cookie
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert.match(setCookie, /auth_token=;/);
  assert.match(setCookie, /sso_session_id=;/);
});

test("logout-all: SSO logout 端点返回非 2xx 不阻断本地退出（ssoLogoutBackendOk=false）", async () => {
  setEnv(fullEnabledEnv());
  const sessionId = "sess-456";
  saveSsoTokensForSession(sessionId, { accessToken: "at" });

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 405 })) as unknown as typeof fetch;
  let response: Response;
  try {
    response = await logoutAllPost(makeAuthenticatedRequest(sessionId));
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.ssoLogoutBackendOk, false);
  // 仍清了 cookie
  assert.match(response.headers.get("set-cookie") ?? "", /auth_token=;/);
});

test("logout-all: 清理 session-token-store（logout 后 tokens 不可再取）", async () => {
  setEnv(fullEnabledEnv());
  const sessionId = "sess-789";
  saveSsoTokensForSession(sessionId, { accessToken: "at" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("", { status: 200 })) as unknown as typeof fetch;
  try {
    await logoutAllPost(makeAuthenticatedRequest(sessionId));
  } finally {
    globalThis.fetch = originalFetch;
  }
  // 再次取应已清
  const { getSsoTokensForSession } = await import("../../apps/web/lib/auth/sso/session-token-store.ts");
  assert.equal(getSsoTokensForSession(sessionId), null);
});

test("logout-all: SSO 未启用时也清本地 session（不调 SSO logout）", async () => {
  setEnv({ ...fullEnabledEnv(), AGENT_UI_SSO_ENABLED: "false" });
  const sessionId = "sess-disabled";
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = (async () => {
    fetchCalled = true;
    return new Response("", { status: 200 });
  }) as unknown as typeof fetch;
  try {
    const response = await logoutAllPost(makeAuthenticatedRequest(sessionId));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(fetchCalled, false, "SSO 未启用不应调 SSO logout");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("logout-all: 无 sso_session_id cookie（旧 OA 登录用户）仍可本地退出", async () => {
  setEnv(fullEnabledEnv());
  const token = signLoginToken({
    uid: "u1",
    name: "Alice",
    can_manage: false,
    can_manage_whitelist: false,
  });
  const response = await logoutAllPost(
    new Request("http://app/api/auth/sso/logout-all", {
      method: "POST",
      headers: { cookie: `auth_token=${token}` },
    }),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /auth_token=;/);
});
