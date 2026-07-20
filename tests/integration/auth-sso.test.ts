import test from "node:test";
import assert from "node:assert/strict";

import { POST as ssoStartPost } from "../../apps/web/app/api/auth/sso/start/route.ts";
import { GET as ssoCallbackGet } from "../../apps/web/app/api/auth/sso/callback/route.ts";
import { __resetDefaultStateStoreForTests } from "../../apps/web/lib/auth/sso/state-store.ts";
import {
  __resetDefaultSessionTokenStoreForTests,
  getSsoTokensForSession,
} from "../../apps/web/lib/auth/sso/session-token-store.ts";
import { verifyLoginToken } from "../../apps/web/lib/auth/session.ts";

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
    AGENT_UI_SSO_CLIENT_ID: "test-client-id",
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
    LOGIN_TOKEN_SECRET: "integration-secret",
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

type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** 从 set-cookie 头解析出指定 cookie 的值 */
function extractCookie(setCookie: string, name: string): string | null {
  const match = setCookie.match(new RegExp(`${name}=([^;]+)`));
  return match ? match[1] : null;
}

test.beforeEach(() => {
  clearEnv();
  __resetDefaultStateStoreForTests();
  __resetDefaultSessionTokenStoreForTests();
});

test.afterEach(() => {
  clearEnv();
  __resetDefaultStateStoreForTests();
  __resetDefaultSessionTokenStoreForTests();
});

// ===================== start =====================

test("start: SSO 未启用 → 404 sso_disabled", async () => {
  setEnv({ ...fullEnabledEnv(), AGENT_UI_SSO_ENABLED: "false" });
  const response = await ssoStartPost(
    new Request("http://app/api/auth/sso/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.code, "sso_disabled");
});

test("start: 配置缺失 → 500 auth_configuration_error", async () => {
  setEnv({ AGENT_UI_SSO_ENABLED: "true" });
  const response = await ssoStartPost(
    new Request("http://app/api/auth/sso/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.code, "auth_configuration_error");
});

test("start: 成功返回 authorizeUrl，含 state/nonce/PKCE 参数", async () => {
  setEnv(fullEnabledEnv());
  const response = await ssoStartPost(
    new Request("http://app/api/auth/sso/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "/admin/create" }),
    }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  const authorizeUrl = body.authorizeUrl as string;
  assert.ok(authorizeUrl.startsWith("/auth/oauth2/authorize?"), "应使用同域代理路径");
  const params = new URL(authorizeUrl, "http://app").searchParams;
  assert.equal(params.get("client_id"), "test-client-id");
  assert.equal(params.get("response_type"), "code");
  assert.equal(params.get("redirect_uri"), "http://app/api/auth/sso/callback");
  assert.equal(params.get("code_challenge_method"), "S256");
  assert.ok(params.get("state"));
  assert.ok(params.get("nonce"));
  assert.ok(params.get("code_challenge"));
  // scope 用空格分隔的字符串（OAuth2 标准），不用多同名参数
  assert.equal(params.get("scope"), "openid profile");
});

test("start: returnTo 安全过滤（拒绝 javascript:）", async () => {
  setEnv(fullEnabledEnv());
  const response = await ssoStartPost(
    new Request("http://app/api/auth/sso/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ returnTo: "javascript:alert(1)" }),
    }),
  );
  assert.equal(response.status, 200);
  // returnTo 被过滤成默认 /admin，但 start 不直接返回 returnTo，
  // 这里仅验证不报错且返回了 authorizeUrl（过滤发生在内部，callback 时才用）
  const body = await response.json();
  assert.ok(body.authorizeUrl);
});

// ===================== callback =====================

/**
 * 辅助：跑一遍 start 拿到 state，再调 callback。
 * 用 mock fetch 模拟 SSO token/userInfo 端点。
 */
async function runStartThenCallback(args: {
  fetchMock: FetchMock;
  body?: Record<string, unknown>;
}): Promise<Response> {
  setEnv(fullEnabledEnv());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = args.fetchMock as unknown as typeof fetch;
  try {
    const startResponse = await ssoStartPost(
      new Request("http://app/api/auth/sso/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args.body ?? { returnTo: "/admin" }),
      }),
    );
    const startBody = await startResponse.json();
    const state = new URL(startBody.authorizeUrl, "http://app").searchParams.get("state");
    assert.ok(state, "start 未返回 state");

    return await ssoCallbackGet(
      new Request(
        `http://app/api/auth/sso/callback?code=valid-code&state=${encodeURIComponent(state!)}`,
        { method: "GET" },
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/** 构造一个"全成功"的 mock fetch：token 交换 + userInfo 都返回成功 */
function makeHappyPathFetchMock(): FetchMock {
  return async (input) => {
    const url = String(input);
    if (url.includes("/auth/oauth2/token")) {
      return jsonResponse({
        access_token: "at-happy",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "rt-happy",
        id_token: undefined, // 不带 id_token，跳过 claims 校验
      });
    }
    if (url.includes("/system/user/getInfo")) {
      return jsonResponse({
        data: { user: { userAccount: "12061413", userName: "张三", deptName: "安全部" } },
      });
    }
    return new Response("", { status: 404 });
  };
}

test("callback: 成功链路 → 302 success + Set-Cookie + token 含 SSO 用户身份", async () => {
  const response = await runStartThenCallback({ fetchMock: makeHappyPathFetchMock() });
  assert.equal(response.status, 302);
  const location = response.headers.get("location") ?? "";
  assert.ok(location.includes("/auth/callback/success"), `location=${location}`);
  assert.ok(location.includes("returnTo=%2Fadmin"));

  const setCookie = response.headers.get("set-cookie") ?? "";
  const token = extractCookie(setCookie, "auth_token");
  assert.ok(token, "应设置 auth_token cookie");
  assert.ok(extractCookie(setCookie, "sso_session_id"), "应设置 sso_session_id cookie");

  // token 解出的用户身份来自 SSO userInfo
  const verified = verifyLoginToken(token ?? undefined, { secret: "integration-secret" });
  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.equal(verified.user.uid, "12061413");
    assert.equal(verified.user.name, "张三");
    assert.equal(verified.user.department, "安全部");
  }
});

test("callback: SSO tokens 存入 session-token-store（供 logout 用）", async () => {
  const response = await runStartThenCallback({ fetchMock: makeHappyPathFetchMock() });
  const sessionId = extractCookie(response.headers.get("set-cookie") ?? "", "sso_session_id");
  assert.ok(sessionId);
  const tokens = getSsoTokensForSession(sessionId!);
  assert.ok(tokens);
  assert.equal(tokens!.accessToken, "at-happy");
  assert.equal(tokens!.refreshToken, "rt-happy");
});

test("callback: 缺 code/state → 302 failure invalid_request", async () => {
  setEnv(fullEnabledEnv());
  const response = await ssoCallbackGet(
    new Request("http://app/api/auth/sso/callback", { method: "GET" }),
  );
  assert.equal(response.status, 302);
  assert.ok(response.headers.get("location")?.includes("error=invalid_request"));
});

test("callback: state 无效/已消费 → 302 failure invalid_state", async () => {
  setEnv(fullEnabledEnv());
  const response = await ssoCallbackGet(
    new Request(
      "http://app/api/auth/sso/callback?code=c&state=nonexistent-state",
      { method: "GET" },
    ),
  );
  assert.equal(response.status, 302);
  assert.ok(response.headers.get("location")?.includes("error=invalid_state"));
});

test("callback: token 交换失败 → 302 failure exchange_failed", async () => {
  const fetchMock: FetchMock = async (input) => {
    if (String(input).includes("/auth/oauth2/token")) {
      return new Response('{"error":"invalid_grant"}', { status: 401 });
    }
    return new Response("", { status: 404 });
  };
  const response = await runStartThenCallback({ fetchMock });
  assert.equal(response.status, 302);
  assert.ok(response.headers.get("location")?.includes("error=exchange_failed"));
});

test("callback: userInfo 拉取失败 → 302 failure profile_failed", async () => {
  const fetchMock: FetchMock = async (input) => {
    const url = String(input);
    if (url.includes("/auth/oauth2/token")) {
      return jsonResponse({ access_token: "at", token_type: "Bearer" });
    }
    if (url.includes("/system/user/getInfo")) {
      return new Response("", { status: 500 });
    }
    return new Response("", { status: 404 });
  };
  const response = await runStartThenCallback({ fetchMock });
  assert.equal(response.status, 302);
  assert.ok(response.headers.get("location")?.includes("error=profile_failed"));
});

test("callback: userInfo 缺 userAccount → 302 failure missing_user_account", async () => {
  const fetchMock: FetchMock = async (input) => {
    const url = String(input);
    if (url.includes("/auth/oauth2/token")) {
      return jsonResponse({ access_token: "at", token_type: "Bearer" });
    }
    if (url.includes("/system/user/getInfo")) {
      return jsonResponse({ data: { user: { userName: "无名" } } });
    }
    return new Response("", { status: 404 });
  };
  const response = await runStartThenCallback({ fetchMock });
  assert.equal(response.status, 302);
  assert.ok(response.headers.get("location")?.includes("error=missing_user_account"));
});

test("callback: state 一次性消费——重放同一 state 返回 invalid_state", async () => {
  setEnv(fullEnabledEnv());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = makeHappyPathFetchMock() as unknown as typeof fetch;
  try {
    const startResponse = await ssoStartPost(
      new Request("http://app/api/auth/sso/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const startBody = await startResponse.json();
    const state = new URL(startBody.authorizeUrl, "http://app").searchParams.get("state");

    const callbackUrl = `http://app/api/auth/sso/callback?code=c&state=${encodeURIComponent(state!)}`;
    // 第一次消费成功
    const first = await ssoCallbackGet(new Request(callbackUrl, { method: "GET" }));
    assert.equal(first.status, 302);
    assert.ok(first.headers.get("location")?.includes("/auth/callback/success"));
    // 第二次重放 → invalid_state
    const second = await ssoCallbackGet(new Request(callbackUrl, { method: "GET" }));
    assert.equal(second.status, 302);
    assert.ok(second.headers.get("location")?.includes("error=invalid_state"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
