/**
 * SSO 相关 cookie 名称常量。
 *
 * 抽到独立文件，避免从 route handler 反向导入（Next.js 中 route.ts
 * 不应被其它模块 import，否则可能触发构建告警或副作用）。
 */

/** SSO session id cookie 名（存本系统生成的 sessionId，logout-all 据此找 SSO tokens） */
export const SSO_SESSION_COOKIE_NAME = "sso_session_id";

export function getSsoSessionCookieName(): string {
  return SSO_SESSION_COOKIE_NAME;
}
