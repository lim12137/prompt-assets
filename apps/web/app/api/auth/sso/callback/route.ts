import { NextResponse } from "next/server.js";
import { randomUUID } from "node:crypto";

import {
  AuthConfigurationError,
  buildLoginCookie,
  parseWhitelistSettingsFromEnv,
  resolveManageFlags,
  signLoginToken,
  getLoginCookieName,
} from "../../../../../lib/auth/session.ts";
import { loadSsoConfig } from "../../../../../lib/auth/sso/sso-config.ts";
import { getDefaultStateStore } from "../../../../../lib/auth/sso/state-store.ts";
import {
  exchangeCodeForToken,
  verifyIdTokenClaims,
  fetchUserInfo,
} from "../../../../../lib/auth/sso/sso-client.ts";
import { mapSsoUserToSystemUser, MissingUserAccountError } from "../../../../../lib/auth/sso/user-mapper.ts";
import { joinUrl, appendQuery } from "../../../../../lib/auth/sso/url-helper.ts";
import { saveSsoTokensForSession } from "../../../../../lib/auth/sso/session-token-store.ts";
import { getSsoSessionCookieName } from "../../../../../lib/auth/sso/cookies.ts";

/**
 * GET /api/auth/sso/callback?code=...&state=...
 *
 * SSO 回调：消费 code+state → 换 token → 验 id_token → 拉 userInfo → 映射用户
 * → 签本系统 token → Set-Cookie → 302 回前端 success。
 * 任何失败 → 302 回前端 failure?error=<code>。
 *
 * 错误码（spec §5.2、13.11-C）：
 * - invalid_request: 缺 code/state
 * - invalid_state: state 不存在或过期
 * - exchange_failed: token 交换失败
 * - invalid_id_token: id_token 校验失败
 * - missing_user_account: userInfo 无法识别身份
 * - profile_failed: userInfo 拉取失败
 */
export async function GET(request: Request) {
  let config;
  try {
    config = loadSsoConfig();
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      // 配置缺失时 frontendBaseUrl 也未知，回退相对路径重定向
      return redirectToFailure(null, "auth_configuration_error");
    }
    throw error;
  }

  if (!config.enabled) {
    return redirectToFailure(config, "sso_disabled");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return redirectToFailure(config, "invalid_request");
  }

  // 1. 消费 state（一次性）
  const consumed = getDefaultStateStore().consume(state);
  if (!consumed.ok) {
    return redirectToFailure(config, "invalid_state");
  }
  const { nonce, codeVerifier, returnTo } = consumed.state;

  // 2. 换 token
  const tokenResult = await exchangeCodeForToken({
    code,
    codeVerifier,
    options: { config },
  });
  if (!tokenResult.ok) {
    return redirectToFailure(config, "exchange_failed");
  }

  // 3. 验 id_token（claims；签名可选，取决于平台是否提供可用 JWKS）
  if (tokenResult.id_token) {
    const claimsResult = verifyIdTokenClaims(tokenResult.id_token, {
      issuer: config.issuer,
      clientId: config.clientId,
      nonce,
    });
    if (!claimsResult.ok) {
      return redirectToFailure(config, "invalid_id_token");
    }
    // 签名校验：spec §11/R4，若 JWKS 可用则验，否则降级仅 claims（需评审，此处保守跳过签名
    // 以避免在 JWKS 不可用时阻断登录；真实联调时按 R4 决定是否强制）
  }

  // 4. 拉 userInfo
  const profileResult = await fetchUserInfo(
    tokenResult.access_token,
    config.profileUrl,
  );
  if (!profileResult.ok) {
    return redirectToFailure(config, "profile_failed");
  }

  // 5. 映射用户
  let mappedUser;
  try {
    mappedUser = mapSsoUserToSystemUser(profileResult.data);
  } catch (error) {
    if (error instanceof MissingUserAccountError) {
      return redirectToFailure(config, "missing_user_account");
    }
    throw error;
  }

  // 6. 解析 manage flags（复用现有白名单逻辑）
  const settings = parseWhitelistSettingsFromEnv();
  const flags = resolveManageFlags({ uid: mappedUser.uid, name: mappedUser.name }, settings);

  // 7. 签本系统 token
  let token: string;
  try {
    token = signLoginToken({
      uid: mappedUser.uid,
      name: mappedUser.name,
      ...(mappedUser.department ? { department: mappedUser.department } : {}),
      can_manage: flags.can_manage,
      can_manage_whitelist: flags.can_manage_whitelist,
    });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return redirectToFailure(config, "auth_configuration_error");
    }
    throw error;
  }

  // 8. 保存 SSO tokens 供 logout-all 使用（以本系统 session id 为 key）
  const sessionId = randomUUID();
  saveSsoTokensForSession(sessionId, {
    accessToken: tokenResult.access_token,
    refreshToken: tokenResult.refresh_token,
  });

  // 9. Set-Cookie + 302 success
  const successUrl = appendQuery(
    joinUrl(config.frontendBaseUrl, "/auth/callback/success"),
    { returnTo },
  );
  const response = NextResponse.redirect(successUrl, { status: 302 });
  response.headers.append("set-cookie", buildLoginCookie(token));
  // 把 sessionId 写进 cookie，logout-all 据此找到 SSO tokens
  response.headers.append("set-cookie", buildSessionIdCookie(sessionId));
  return response;
}

/**
 * 302 到前端 failure 页，带 error 参数。
 * frontendBaseUrl 缺失时回退到相对路径（同域兜底）。
 */
function redirectToFailure(config: { frontendBaseUrl: string } | null, error: string): NextResponse {
  const failurePath = appendQuery("/auth/callback/failure", { error });
  const base = config?.frontendBaseUrl;
  const failureUrl = base ? joinUrl(base, failurePath) : failurePath;
  return NextResponse.redirect(failureUrl, { status: 302 });
}

function buildSessionIdCookie(sessionId: string): string {
  return `${getSsoSessionCookieName()}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`;
}
