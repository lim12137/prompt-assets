import { NextResponse } from "next/server.js";

import {
  AuthConfigurationError,
  buildClearLoginCookie,
  getUserFromRequest,
} from "../../../../../lib/auth/session.ts";
import { loadSsoConfig } from "../../../../../lib/auth/sso/sso-config.ts";
import { revokeAtSso } from "../../../../../lib/auth/sso/sso-client.ts";
import {
  getSsoTokensForSession,
  deleteSsoTokensForSession,
} from "../../../../../lib/auth/sso/session-token-store.ts";
import { getSsoSessionCookieName } from "../../../../../lib/auth/sso/cookies.ts";

/**
 * POST /api/auth/sso/logout-all
 *
 * 大退：清本系统 session + 触发 SSO 全局退出。
 *
 * 链路（spec §2.3、§5.3、playbook 13.7/13.10）：
 * 1. 读本系统 session；无 session → 401（不让前端误判成功）。
 * 2. 取 sso_session_id cookie，查 SSO access_token。
 * 3. 调 SSO logout 端点（POST + Bearer），服务端清 token session。
 * 4. 清本系统 cookie（auth_token + sso_session_id）。
 * 5. 返回同域 SSO logout 路径，前端据此让浏览器访问 /auth/oauth2/session/logout/all
 *    （同域，清 SSO HttpOnly Cookie）——这是大退能真正生效的关键。
 *
 * 大退验收（playbook 13.10）：必须浏览器验收"登录 → 大退 → 再点 SSO 必须重新认证"。
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

  // 1. 本系统 session 必须存在
  const user = getUserFromRequest(request);
  if (!user) {
    return NextResponse.json(
      { error: "no session", code: "no_session" },
      { status: 401 },
    );
  }

  // 2. 取 SSO tokens（可能不存在：用户用旧 OA 登录、或 SSO 未启用）
  const sessionId = parseCookie(request.headers.get("cookie"), getSsoSessionCookieName());
  const ssoTokens = sessionId ? getSsoTokensForSession(sessionId) : null;

  // 3. 调 SSO logout（服务端清 token session）
  let ssoLogoutOk = true;
  if (ssoTokens && config.enabled) {
    const revokeResult = await revokeAtSso({
      accessToken: ssoTokens.accessToken,
      logoutUrl: config.logoutUrl,
    });
    ssoLogoutOk = revokeResult.ok;
  }

  // 4. 清本系统 session 存储
  if (sessionId) {
    deleteSsoTokensForSession(sessionId);
  }

  // 5. 清 cookie + 返回同域 SSO logout 路径（前端跳转，让浏览器同域清 SSO Cookie）
  const response = NextResponse.json(
    {
      ok: true,
      // 前端拿到后跳转此路径，浏览器同域访问 /auth/oauth2/session/logout/all，
      // SSO HttpOnly Cookie 被清（playbook 坑 9 的解法）。
      // 仅 SSO 启用且有 tokens 时才需要；否则前端直接回首页。
      ...(config.enabled && ssoTokens
        ? { ssoLogoutUrl: "/auth/oauth2/session/logout/all" }
        : {}),
      ssoLogoutBackendOk: ssoLogoutOk,
    },
    { status: 200 },
  );
  response.headers.append("set-cookie", buildClearLoginCookie());
  response.headers.append("set-cookie", buildClearSsoSessionIdCookie());
  return response;
}

function parseCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function buildClearSsoSessionIdCookie(): string {
  return `${getSsoSessionCookieName()}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
