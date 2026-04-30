export function normalizeLoginRedirectPath(currentPath: string | undefined | null): string {
  if (typeof currentPath !== "string") {
    return "";
  }
  const value = currentPath.trim();
  if (!value.startsWith("/")) {
    return "";
  }
  if (value.startsWith("/login")) {
    return "";
  }
  return value;
}

export function buildLoginHref(currentPath: string | undefined | null): string {
  const normalizedPath = normalizeLoginRedirectPath(currentPath);
  if (!normalizedPath) {
    return "/login";
  }
  return `/login?redirect=${encodeURIComponent(normalizedPath)}`;
}
