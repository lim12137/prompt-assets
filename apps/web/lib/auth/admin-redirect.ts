const ADMIN_FALLBACK_PATH = "/admin";

const PATH_HEADER_KEYS = [
  "x-pathname",
  "next-url",
  "x-forwarded-uri",
  "x-rewrite-url",
];

function normalizePathname(rawValue: string | null | undefined): string | null {
  if (!rawValue) {
    return null;
  }
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return parsed.pathname;
  } catch {
    return null;
  }
}

export function resolveAdminRedirectTarget(
  headerStore: Pick<Headers, "get"> | null | undefined,
): string {
  for (const key of PATH_HEADER_KEYS) {
    const pathname = normalizePathname(headerStore?.get(key));
    if (pathname?.startsWith("/admin")) {
      return pathname;
    }
  }
  return ADMIN_FALLBACK_PATH;
}
