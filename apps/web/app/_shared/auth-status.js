import { getLoginCookieName, verifyLoginToken } from "../../lib/auth/session.ts";
import { resolveLoginRedirectTarget } from "../../lib/auth/login-redirect.ts";
import { buildLoginHref } from "../../lib/auth/login-link.ts";
import { LogoutButton } from "./logout-button.js";

export function AuthStatusContent({ user, currentPath }) {
  const loginHref = buildLoginHref(currentPath);
  if (!user) {
    return (
      <a className="pm-auth-link" href={loginHref}>
        登录
      </a>
    );
  }

  const identity = user.name || user.uid || "已登录";
  return (
    <div className="pm-auth-user-wrap">
      <span className="pm-auth-user-id" title={identity}>
        {identity}
      </span>
      <LogoutButton />
    </div>
  );
}

export function resolveUserFromCookieToken(token) {
  const verified = verifyLoginToken(token);
  if (!verified.ok) {
    return null;
  }
  return verified.user;
}

export function resolveAuthState({ cookieStore, headerStore }) {
  const token = cookieStore.get(getLoginCookieName())?.value;
  const user = resolveUserFromCookieToken(token);
  const currentPath = resolveLoginRedirectTarget(headerStore);
  return { user, currentPath };
}
