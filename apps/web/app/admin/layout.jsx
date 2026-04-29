import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  AuthConfigurationError,
  getLoginCookieName,
  verifyLoginToken,
} from "../../lib/auth/session.ts";

function redirectToLogin(targetPath) {
  redirect(`/login?redirect=${encodeURIComponent(targetPath)}`);
}

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
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
    redirectToLogin("/admin");
  }

  return children;
}
