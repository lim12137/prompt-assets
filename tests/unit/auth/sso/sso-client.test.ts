import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createSign } from "node:crypto";

import {
  exchangeCodeForToken,
  decodeIdTokenPayload,
  verifyIdTokenClaims,
  verifyIdTokenSignature,
  fetchJwks,
  fetchUserInfo,
  revokeAtSso,
} from "../../../../apps/web/lib/auth/sso/sso-client.ts";
import type { SsoConfig } from "../../../../apps/web/lib/auth/sso/sso-config.ts";

// ---- helpers ----

function makeConfig(overrides: Partial<SsoConfig> = {}): SsoConfig {
  return {
    enabled: true,
    clientId: "test-client-id",
    clientSecret: "test-secret-do-not-use-in-prod",
    redirectUri: "http://app/api/auth/sso/callback",
    ssoOrigin: "http://sso:19210",
    authorizeUrl: "http://sso:19210/auth/oauth2/authorize",
    tokenUrl: "http://sso:19210/auth/oauth2/token",
    profileUrl: "http://sso:19210/system/user/getInfo",
    jwksUrl: "http://sso:19210/auth/oauth2/jwks",
    issuer: "http://sso:19210/auth",
    logoutUrl: "http://sso:19210/auth/oauth2/session/logout/all",
    scope: ["openid", "profile"],
    stateTtlSeconds: 300,
    frontendBaseUrl: "http://app",
    legacyLoginVisible: false,
    ...overrides,
  };
}

/** 用 RS256 私钥签一个 id_token（用于验签测试） */
function signRs256IdToken(payload: object, privateKeyPem: string, kid?: string): string {
  const header = { alg: "RS256", typ: "JWT", ...(kid ? { kid } : {}) };
  const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signedContent = `${headerB64}.${payloadB64}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signedContent, "utf8");
  const signature = signer.sign(privateKeyPem, "base64url");
  // base64url：把 + 换 -、/ 换 _、去 =
  const sigUrl = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${signedContent}.${sigUrl}`;
}

/** mock fetch 的极简实现：按 URL 返回预设 Response */
type FetchMock = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// ===================== exchangeCodeForToken =====================

test("exchangeCodeForToken: 成功返回 token 集合，请求带 Basic Auth + code_verifier", async () => {
  const config = makeConfig();
  let receivedAuth: string | null = null;
  let receivedBody: string | null = null;
  const fetchMock: FetchMock = async (_input, init) => {
    receivedAuth = init?.headers?.authorization ?? null;
    receivedBody = typeof init?.body === "string" ? init.body : null;
    return jsonResponse({
      access_token: "at-123",
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: "rt-456",
      id_token: "eyJhbGciOiJSUzI1NiJ9.eyJpc3MiOiJodHRwOi8vc3NvOjE5MjEwL2F1dGgifQ.sig",
    });
  };
  const result = await exchangeCodeForToken({
    code: "code-abc",
    codeVerifier: "verifier-xyz",
    options: { config, fetchImpl: fetchMock as unknown as typeof fetch },
  });
  assert.equal(result.ok !== false, true);
  if (result.ok !== false) {
    assert.equal(result.access_token, "at-123");
    assert.equal(result.refresh_token, "rt-456");
    assert.ok(typeof result.id_token === "string");
  }
  // 断言 Basic Auth（机密客户端）
  assert.equal(receivedAuth?.startsWith("Basic "), true);
  const decoded = Buffer.from(receivedAuth!.slice("Basic ".length), "base64").toString("utf8");
  assert.equal(decoded, "test-client-id:test-secret-do-not-use-in-prod");
  // 断言 body 含 grant_type/code/redirect_uri/code_verifier，且不含 client_secret
  assert.ok(receivedBody!.includes("grant_type=authorization_code"));
  assert.ok(receivedBody!.includes("code=code-abc"));
  assert.ok(receivedBody!.includes("code_verifier=verifier-xyz"));
  assert.ok(receivedBody!.includes("redirect_uri="));
  assert.ok(!receivedBody!.includes("client_secret"));
});

test("exchangeCodeForToken: SSO 返回非 2xx → exchange_failed + ssoError", async () => {
  const config = makeConfig();
  const fetchMock: FetchMock = async () =>
    new Response('{"error":"invalid_client"}', { status: 401 });
  const result = await exchangeCodeForToken({
    code: "code",
    codeVerifier: "v",
    options: { config, fetchImpl: fetchMock as unknown as typeof fetch },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "exchange_failed");
    assert.ok(result.ssoError?.includes("invalid_client"));
  }
});

test("exchangeCodeForToken: 响应缺 access_token → exchange_failed", async () => {
  const config = makeConfig();
  const fetchMock: FetchMock = async () => jsonResponse({ token_type: "Bearer" });
  const result = await exchangeCodeForToken({
    code: "code",
    codeVerifier: "v",
    options: { config, fetchImpl: fetchMock as unknown as typeof fetch },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "exchange_failed");
    assert.match(result.message, /access_token/);
  }
});

test("exchangeCodeForToken: fetch 抛错 → exchange_failed", async () => {
  const config = makeConfig();
  const fetchMock: FetchMock = async () => {
    throw new Error("ECONNREFUSED");
  };
  const result = await exchangeCodeForToken({
    code: "code",
    codeVerifier: "v",
    options: { config, fetchImpl: fetchMock as unknown as typeof fetch },
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "exchange_failed");
    assert.match(result.message, /ECONNREFUSED/);
  }
});

// ===================== decodeIdTokenPayload =====================

test("decodeIdTokenPayload: 正常 JWT 解出 payload", () => {
  const payload = { iss: "http://sso:19210/auth", aud: "cid", exp: 9999999999, nonce: "n1" };
  const token = `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
  const decoded = decodeIdTokenPayload(token);
  assert.deepEqual(decoded, payload);
});

test("decodeIdTokenPayload: 非 JWT 返回 null", () => {
  assert.equal(decodeIdTokenPayload("not-a-jwt"), null);
  assert.equal(decodeIdTokenPayload("a.b"), null);
  assert.equal(decodeIdTokenPayload(""), null);
});

test("decodeIdTokenPayload: payload 非 JSON 返回 null", () => {
  const token = `header.${Buffer.from("not-json").toString("base64url")}.sig`;
  assert.equal(decodeIdTokenPayload(token), null);
});

// ===================== verifyIdTokenClaims =====================

const VALID_PAYLOAD = {
  iss: "http://sso:19210/auth",
  aud: "test-client-id",
  exp: 9999999999,
  nonce: "expected-nonce",
};

function makeIdToken(payload: object): string {
  return `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
}

test("verifyIdTokenClaims: 全部匹配 → ok", () => {
  const token = makeIdToken(VALID_PAYLOAD);
  const result = verifyIdTokenClaims(token, {
    issuer: "http://sso:19210/auth",
    clientId: "test-client-id",
    nonce: "expected-nonce",
  });
  assert.equal(result.ok, true);
});

test("verifyIdTokenClaims: iss 不匹配 → bad_iss", () => {
  const token = makeIdToken({ ...VALID_PAYLOAD, iss: "http://wrong/auth" });
  const result = verifyIdTokenClaims(token, {
    issuer: "http://sso:19210/auth",
    clientId: "test-client-id",
    nonce: "expected-nonce",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "bad_iss");
  }
});

test("verifyIdTokenClaims: aud 不匹配 → bad_aud", () => {
  const token = makeIdToken({ ...VALID_PAYLOAD, aud: "wrong-client" });
  const result = verifyIdTokenClaims(token, {
    issuer: "http://sso:19210/auth",
    clientId: "test-client-id",
    nonce: "expected-nonce",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "bad_aud");
  }
});

test("verifyIdTokenClaims: aud 是数组时包含 clientId → ok", () => {
  const token = makeIdToken({ ...VALID_PAYLOAD, aud: ["other", "test-client-id"] });
  const result = verifyIdTokenClaims(token, {
    issuer: "http://sso:19210/auth",
    clientId: "test-client-id",
    nonce: "expected-nonce",
  });
  assert.equal(result.ok, true);
});

test("verifyIdTokenClaims: exp 已过期 → expired", () => {
  const token = makeIdToken({ ...VALID_PAYLOAD, exp: 1 });
  const result = verifyIdTokenClaims(token, {
    issuer: "http://sso:19210/auth",
    clientId: "test-client-id",
    nonce: "expected-nonce",
    now: new Date("2026-07-04T00:00:00Z"),
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "expired");
  }
});

test("verifyIdTokenClaims: nonce 不匹配 → bad_nonce", () => {
  const token = makeIdToken({ ...VALID_PAYLOAD, nonce: "wrong-nonce" });
  const result = verifyIdTokenClaims(token, {
    issuer: "http://sso:19210/auth",
    clientId: "test-client-id",
    nonce: "expected-nonce",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "bad_nonce");
  }
});

test("verifyIdTokenClaims: malformed JWT → malformed", () => {
  const result = verifyIdTokenClaims("not-a-jwt", {
    issuer: "x",
    clientId: "x",
    nonce: "x",
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "malformed");
  }
});

// ===================== verifyIdTokenSignature（真实 RS256） =====================

test("verifyIdTokenSignature: 正确签名通过", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const token = signRs256IdToken(VALID_PAYLOAD, privateKeyPem, "kid-1");
  const result = verifyIdTokenSignature(token, { "kid-1": publicKeyPem });
  assert.equal(result, true);
});

test("verifyIdTokenSignature: 错误签名拒绝", () => {
  const { privateKey: priv1, publicKey: pub1 } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const { privateKey: priv2 } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const token = signRs256IdToken(VALID_PAYLOAD, priv2.export({ type: "pkcs8", format: "pem" }).toString(), "kid-1");
  const result = verifyIdTokenSignature(token, {
    "kid-1": pub1.export({ type: "spki", format: "pem" }).toString(),
  });
  assert.equal(result, false);
});

test("verifyIdTokenSignature: kid 未命中拒绝", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const token = signRs256IdToken(VALID_PAYLOAD, privateKey.export({ type: "pkcs8", format: "pem" }).toString(), "kid-A");
  const result = verifyIdTokenSignature(token, { "kid-B": publicKey.export({ type: "spki", format: "pem" }).toString() });
  assert.equal(result, false);
});

test("verifyIdTokenSignature: 非 RS256 算法拒绝（防算法混淆）", () => {
  const payload = makeIdToken({ ...VALID_PAYLOAD });
  // header 改成 HS256
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const parts = payload.split(".");
  const tampered = `${header}.${parts[1]}.${parts[2]}`;
  const result = verifyIdTokenSignature(tampered, { default: "any-pem" });
  assert.equal(result, false);
});

// ===================== fetchJwks =====================

test("fetchJwks: 解析 RSA 公钥集", async () => {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" }) as { n: string; e: string };
  const fetchMock: FetchMock = async () =>
    jsonResponse({ keys: [{ kid: "k1", kty: "RSA", n: jwk.n, e: jwk.e }] });
  const result = await fetchJwks("http://sso/jwks", fetchMock as unknown as typeof fetch);
  assert.equal(typeof result["k1"], "string");
  assert.ok(result["k1"].includes("BEGIN PUBLIC KEY"));
});

test("fetchJwks: 非 2xx 抛错", async () => {
  const fetchMock: FetchMock = async () => new Response("", { status: 500 });
  await assert.rejects(() => fetchJwks("http://sso/jwks", fetchMock as unknown as typeof fetch));
});

test("fetchJwks: 缺 keys 数组抛错", async () => {
  const fetchMock: FetchMock = async () => jsonResponse({});
  await assert.rejects(() => fetchJwks("http://sso/jwks", fetchMock as unknown as typeof fetch));
});

test("fetchJwks: 跳过非 RSA key", async () => {
  const fetchMock: FetchMock = async () =>
    jsonResponse({ keys: [{ kid: "oct", kty: "oct", k: "x" }] });
  const result = await fetchJwks("http://sso/jwks", fetchMock as unknown as typeof fetch);
  assert.deepEqual(result, {});
});

// ===================== fetchUserInfo =====================

test("fetchUserInfo: 成功返回 data", async () => {
  const fetchMock: FetchMock = async (input, init) => {
    assert.equal(init?.headers?.authorization, "Bearer at-123");
    assert.equal(String(input), "http://sso/profile");
    return jsonResponse({ data: { user: { userAccount: "u1" } } });
  };
  const result = await fetchUserInfo("at-123", "http://sso/profile", fetchMock as unknown as typeof fetch);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.data, { data: { user: { userAccount: "u1" } } });
  }
});

test("fetchUserInfo: 非 2xx → profile_failed", async () => {
  const fetchMock: FetchMock = async () => new Response("", { status: 401 });
  const result = await fetchUserInfo("at", "http://sso/profile", fetchMock as unknown as typeof fetch);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "profile_failed");
  }
});

test("fetchUserInfo: fetch 抛错 → profile_failed", async () => {
  const fetchMock: FetchMock = async () => {
    throw new Error("network down");
  };
  const result = await fetchUserInfo("at", "http://sso/profile", fetchMock as unknown as typeof fetch);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /network down/);
  }
});

test("fetchUserInfo: 非 JSON → profile_failed", async () => {
  const fetchMock: FetchMock = async () =>
    new Response("not json", { status: 200, headers: { "content-type": "text/plain" } });
  const result = await fetchUserInfo("at", "http://sso/profile", fetchMock as unknown as typeof fetch);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "profile_failed");
  }
});

// ===================== revokeAtSso =====================

test("revokeAtSso: 成功（2xx）", async () => {
  let receivedMethod: string | null = null;
  let receivedAuth: string | null = null;
  const fetchMock: FetchMock = async (_input, init) => {
    receivedMethod = init?.method ?? null;
    receivedAuth = init?.headers?.authorization ?? null;
    return new Response("", { status: 200 });
  };
  const result = await revokeAtSso({
    accessToken: "at-123",
    logoutUrl: "http://sso/logout",
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
  assert.equal(result.ok, true);
  assert.equal(receivedMethod, "POST");
  assert.equal(receivedAuth, "Bearer at-123");
});

test("revokeAtSso: 非 2xx 返回 ok:false 但不抛（不阻断本地退出）", async () => {
  const fetchMock: FetchMock = async () => new Response("", { status: 405 });
  const result = await revokeAtSso({
    accessToken: "at",
    logoutUrl: "http://sso/logout",
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /405/);
  }
});

test("revokeAtSso: fetch 抛错返回 ok:false 不抛", async () => {
  const fetchMock: FetchMock = async () => {
    throw new Error("timeout");
  };
  const result = await revokeAtSso({
    accessToken: "at",
    logoutUrl: "http://sso/logout",
    fetchImpl: fetchMock as unknown as typeof fetch,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.message, /timeout/);
  }
});
