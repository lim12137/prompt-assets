import { createPublicKey, createVerify } from "node:crypto";

import type { SsoConfig } from "./sso-config.ts";
import { buildClientBasicAuth } from "./sso-config.ts";

/**
 * SSO OAuth/OIDC client：token 交换、id_token 校验、userInfo 拉取、logout。
 *
 * 安全要点（playbook 5.3、坑 2、§3）：
 * - token 交换走 HTTP Basic Auth（client_secret_basic），body 不重复放 client_secret。
 * - PKCE code_verifier 与 start 阶段一致。
 * - id_token 校验 iss/aud/exp/nonce；如提供 JWKS 则验签（RS256）。
 * - access_token/refresh_token 只在后端内存里（state-store），绝不返回前端或写日志。
 */

export type TokenExchangeResult = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

export type TokenExchangeError = {
  ok: false;
  code: "exchange_failed";
  message: string;
  /** SSO 返回的 error/error_description，便于排障（playbook 坑 7） */
  ssoError?: string;
};

export type IdTokenPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nonce?: string;
  sub?: string;
  [key: string]: unknown;
};

export type IdTokenVerifyError =
  | { ok: false; code: "invalid_id_token"; reason: "malformed" | "bad_iss" | "bad_aud" | "expired" | "bad_nonce" | "bad_signature" }
  | { ok: false; code: "missing_id_token" };

export type UserInfoResult =
  | { ok: true; data: unknown }
  | { ok: false; code: "profile_failed"; message: string };

/** 可注入的 fetch（测试用），默认 globalThis.fetch */
type FetchLike = typeof globalThis.fetch;

export type SsoClientOptions = {
  config: SsoConfig;
  /** 注入 fetch，便于测试 mock SSO 端点 */
  fetchImpl?: FetchLike;
};

/**
 * 用授权码换 token。
 *
 * @param code SSO 回调带回的授权码
 * @param codeVerifier start 阶段存的 PKCE code_verifier
 */
export async function exchangeCodeForToken(
  args: {
    code: string;
    codeVerifier: string;
    options: SsoClientOptions;
  },
): Promise<TokenExchangeResult | TokenExchangeError> {
  const { config } = args.options;
  const fetchImpl = args.options.fetchImpl ?? globalThis.fetch;

  let response: Response;
  try {
    response = await fetchImpl(args.options.config.tokenUrl, {
      method: "POST",
      headers: {
        authorization: buildClientBasicAuth(config),
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: args.code,
        redirect_uri: config.redirectUri,
        code_verifier: args.codeVerifier,
      }).toString(),
    });
  } catch (err) {
    return {
      ok: false,
      code: "exchange_failed",
      message: err instanceof Error ? err.message : "token endpoint unreachable",
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      code: "exchange_failed",
      message: `token endpoint returned ${response.status}`,
      ssoError: text.slice(0, 500),
    };
  }

  const json = (await response.json().catch(() => null)) as TokenExchangeResult | null;
  if (!json || typeof json.access_token !== "string") {
    return {
      ok: false,
      code: "exchange_failed",
      message: "token response missing access_token",
    };
  }
  return json;
}

/**
 * 解析 id_token（JWT）的 payload，不验签。
 * 仅用于读取 iss/aud/exp/nonce 做基础校验。
 */
export function decodeIdTokenPayload(idToken: string): IdTokenPayload | null {
  const parts = idToken.split(".");
  if (parts.length < 2) {
    return null;
  }
  try {
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(payloadJson) as IdTokenPayload;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 校验 id_token：iss/aud/exp/nonce。
 *
 * 注意：本函数只做 payload 层校验。签名校验由 verifyIdTokenSignature() 负责，
 * 是否调用取决于平台是否提供可用 JWKS（spec §11/R4）。
 */
export function verifyIdTokenClaims(
  idToken: string,
  expected: { issuer: string; clientId: string; nonce: string; now?: Date },
): IdTokenVerifyError | { ok: true; payload: IdTokenPayload } {
  const payload = decodeIdTokenPayload(idToken);
  if (!payload) {
    return { ok: false, code: "invalid_id_token", reason: "malformed" };
  }

  if (typeof payload.iss === "string" && payload.iss !== expected.issuer) {
    return { ok: false, code: "invalid_id_token", reason: "bad_iss" };
  }

  const aud = payload.aud;
  const audMatch = Array.isArray(aud)
    ? aud.includes(expected.clientId)
    : aud === expected.clientId;
  if (!audMatch) {
    return { ok: false, code: "invalid_id_token", reason: "bad_aud" };
  }

  const nowSec = Math.floor((expected.now ?? new Date()).getTime() / 1000);
  if (typeof payload.exp === "number" && payload.exp <= nowSec) {
    return { ok: false, code: "invalid_id_token", reason: "expired" };
  }

  if (typeof payload.nonce === "string" && expected.nonce && payload.nonce !== expected.nonce) {
    return { ok: false, code: "invalid_id_token", reason: "bad_nonce" };
  }

  return { ok: true, payload };
}

/**
 * 用 JWKS 公钥验 id_token 签名（RS256）。
 *
 * @param idToken JWT
 * @param jwksKeys 已解析的公钥集合（kid → PEM）。由 fetchJwks 拉取并缓存。
 * @returns 签名是否有效；kid 未命中或签名不匹配都返回 false。
 */
export function verifyIdTokenSignature(idToken: string, jwksKeys: Record<string, string>): boolean {
  const parts = idToken.split(".");
  if (parts.length < 3) {
    return false;
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { kid?: string; alg?: string };
  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  } catch {
    return false;
  }
  if (header.alg !== "RS256") {
    // 仅支持 RS256；其它算法（HS256 等）拒绝，避免算法混淆攻击。
    return false;
  }
  const kid = header.kid ?? "default";
  const pem = jwksKeys[kid] ?? jwksKeys["default"];
  if (!pem) {
    return false;
  }
  const signedContent = `${headerB64}.${payloadB64}`;
  const signature = Buffer.from(signatureB64, "base64url");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(signedContent, "utf8");
  try {
    return verifier.verify(createPublicKey(pem), signature);
  } catch {
    return false;
  }
}

/**
 * 拉取 JWKS 并转成 { kid: PEM } 映射。
 *
 * 简化处理：仅解析 RSA 公钥的 n/e，构造 PEM。
 * 真实 JWK → PEM 转换较繁琐，这里用 createPublicKey({ key: jwk }) 直接吃 JWK。
 */
export async function fetchJwks(
  jwksUrl: string,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<Record<string, string>> {
  const response = await fetchImpl(jwksUrl);
  if (!response.ok) {
    throw new Error(`jwks endpoint returned ${response.status}`);
  }
  const json = (await response.json().catch(() => null)) as { keys?: Array<{ kid?: string; kty?: string; n?: string; e?: string }> } | null;
  if (!json || !Array.isArray(json.keys)) {
    throw new Error("jwks response missing keys array");
  }
  const result: Record<string, string> = {};
  for (const key of json.keys) {
    if (key.kty !== "RSA" || !key.n || !key.e) {
      continue;
    }
    try {
      const publicKey = createPublicKey({
        key: { kty: "RSA", n: key.n, e: key.e } as NodeJS.JsonWebKey,
        format: "jwk",
      });
      const pem = publicKey.export({ type: "spki", format: "pem" });
      const kid = key.kid ?? "default";
      result[kid] = typeof pem === "string" ? pem : pem.toString("utf8");
    } catch {
      // 跳过无法解析的 key
    }
  }
  return result;
}

/**
 * 拉取 userInfo（profileUrl）。
 */
export async function fetchUserInfo(
  accessToken: string,
  profileUrl: string,
  fetchImpl: FetchLike = globalThis.fetch,
): Promise<UserInfoResult> {
  let response: Response;
  try {
    response = await fetchImpl(profileUrl, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
  } catch (err) {
    return {
      ok: false,
      code: "profile_failed",
      message: err instanceof Error ? err.message : "profile endpoint unreachable",
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      code: "profile_failed",
      message: `profile endpoint returned ${response.status}`,
    };
  }
  const data = await response.json().catch(() => null);
  if (data === null) {
    return { ok: false, code: "profile_failed", message: "profile response is not json" };
  }
  return { ok: true, data };
}

/**
 * 调用 SSO logout 端点（全局退出）。
 * logoutUrl 通常只接受 POST + Bearer（playbook 坑 13.10）。
 */
export async function revokeAtSso(
  args: { accessToken: string; logoutUrl: string; fetchImpl?: FetchLike },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;
  try {
    const response = await fetchImpl(args.logoutUrl, {
      method: "POST",
      headers: { authorization: `Bearer ${args.accessToken}` },
    });
    // SSO logout 返回非 2xx 不一定是失败（token 可能已过期），记录但不阻断本地退出
    if (!response.ok) {
      return { ok: false, message: `sso logout returned ${response.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "sso logout unreachable" };
  }
}
