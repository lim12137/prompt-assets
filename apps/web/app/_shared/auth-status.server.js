import { cookies, headers } from "next/headers";

import { AuthConfigurationError } from "../../lib/auth/session.ts";
import { AuthStatusContent, resolveAuthState } from "./auth-status.js";

export async function PersistentAuthStatus() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  try {
    const authState = resolveAuthState({
      cookieStore,
      headerStore,
    });
    return <AuthStatusContent user={authState.user} currentPath={authState.currentPath} />;
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return <AuthStatusContent user={null} currentPath="/" />;
    }
    throw error;
  }
}
