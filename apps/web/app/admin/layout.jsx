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

  if (!verified.ok || !verified.user.can_manage) {
    redirectToLogin(resolveAdminRedirectTarget(requestHeaders));
  }

  return children;
}
