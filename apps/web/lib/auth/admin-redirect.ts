import { resolveLoginRedirectTarget } from "./login-redirect.ts";

const ADMIN_FALLBACK_PATH = "/admin";

export function resolveAdminRedirectTarget(
  headerStore: Pick<Headers, "get"> | null | undefined,
): string {
  const pathname = resolveLoginRedirectTarget(headerStore);
  if (pathname.startsWith("/admin")) {
    return pathname;
  }
  return ADMIN_FALLBACK_PATH;
}
