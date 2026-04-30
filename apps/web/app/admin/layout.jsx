import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  AuthConfigurationError,
  getLoginCookieName,
  verifyLoginToken,
} from "../../lib/auth/session.ts";
import { resolveAdminRedirectTarget } from "../../lib/auth/admin-redirect.ts";

function redirectToLogin(targetPath) {
  redirect(`/login?redirect=${encodeURIComponent(targetPath)}`);
}

function AdminForbidden() {
  return (
    <main
      style={{
        maxWidth: "720px",
        margin: "48px auto",
        padding: "24px",
        display: "grid",
        gap: "12px",
      }}
    >
      <h1 className="pm-page-title" style={{ margin: 0 }}>
        无管理权限
      </h1>
      <p style={{ margin: 0, color: "var(--pm-muted)" }}>
        当前账号已登录，但未被授予后台管理权限。
      </p>
      <a className="pm-secondary-button pm-button-link" href="/">
        返回首页
      </a>
    </main>
  );
}

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const token = cookieStore.get(getLoginCookieName())?.value;
  let verified;
  try {
    verified = verifyLoginToken(token);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      throw error;
    }
    throw error;
  }

  if (!verified.ok) {
    redirectToLogin(resolveAdminRedirectTarget(requestHeaders));
  }

  if (!verified.user.can_manage) {
    return <AdminForbidden />;
  }

  return children;
}
