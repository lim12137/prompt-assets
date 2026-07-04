import { cookies, headers } from "next/headers";

import { AuthConfigurationError } from "../../lib/auth/session.ts";
import { loadSsoConfig } from "../../lib/auth/sso/sso-config.ts";
import { AuthStatusContent, resolveAuthState } from "./auth-status.js";

export async function PersistentAuthStatus() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  try {
    const authState = resolveAuthState({
      cookieStore,
      headerStore,
    });
    let ssoEnabled = false;
    try {
      const ssoConfig = loadSsoConfig();
      ssoEnabled = ssoConfig.enabled;
    } catch (error) {
      if (!(error instanceof AuthConfigurationError)) {
        throw error;
      }
      ssoEnabled = false;
    }
    return (
      <AuthStatusContent
        user={authState.user}
        currentPath={authState.currentPath}
        ssoEnabled={ssoEnabled}
      />
    );
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return <AuthStatusContent user={null} currentPath="/" ssoEnabled={false} />;
    }
    throw error;
  }
}
