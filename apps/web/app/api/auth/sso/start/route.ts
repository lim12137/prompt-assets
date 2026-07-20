import { NextResponse } from "next/server.js";
import { randomUUID } from "node:crypto";

import { AuthConfigurationError } from "../../../../../lib/auth/session.ts";
import { loadSsoConfig } from "../../../../../lib/auth/sso/sso-config.ts";
import { generatePkcePair } from "../../../../../lib/auth/sso/pkce.ts";
import { appendQuery, sanitizeReturnTo } from "../../../../../lib/auth/sso/url-helper.ts";
import { getDefaultStateStore } from "../../../../../lib/auth/sso/state-store.ts";

/**
 * POST /api/auth/sso/start
 *
 * 生成 state/nonce/codeVerifier，存入 state-store，返回 authorizeUrl（同域代理路径）。
 * 浏览器拿到 authorizeUrl 后跳转，进入 SSO 登录页（同域 /auth/login）。
 *
 * 安全要点（playbook §3、§5.1）：
 * - state/nonce/codeVerifier 后端生成、后端保存，前端只拿 authorizeUrl。
 * - returnTo 经 sanitizeReturnTo 过滤，防开放跳转。
 * - SSO 未启用 → 404 sso_disabled；配置缺失 → 500 auth_configuration_error。
 * - nonce 在 save 前生成，同一值既存进 state-store（callback 时校验）又拼进 authorizeUrl。
 */
export async function POST(request: Request) {
  let config;
  try {
    config = loadSsoConfig();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "auth_configuration_error" },
        { status: 500 },
      );
    }
    throw error;
  }

  if (!config.enabled) {
    return NextResponse.json(
      { error: "sso is not enabled", code: "sso_disabled" },
      { status: 404 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { returnTo?: unknown };
  const returnTo = sanitizeReturnTo(
    typeof body.returnTo === "string" ? body.returnTo : "/admin",
  );

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const nonce = randomUUID();

  const store = getDefaultStateStore();
  const state = store.save({
    nonce,
    codeVerifier,
    returnTo,
    ttlMs: config.stateTtlSeconds * 1000,
  });

  // 同域 authorizeUrl：浏览器访问应用域下的 /auth/oauth2/authorize，
  // 由 catch-all 代理转发到 SSO origin（spec §2.2）。
  // redirect_uri 用配置的后端 callback 绝对地址（SSO 后台白名单）。
  const authorizeUrl = appendQuery("/auth/oauth2/authorize", {
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    // scope 用空格分隔的字符串（OAuth2 标准），不用数组展开成多同名参数
    // 多数 SSO 平台（含本平台）只认 scope=openid%20profile，不认 scope=openid&scope=profile
    scope: config.scope.join(" "),
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return NextResponse.json({ authorizeUrl }, { status: 200 });
}
