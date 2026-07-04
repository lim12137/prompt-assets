/**
 * URL 拼接归一化 helper。
 *
 * 存在原因（playbook 坑 8）：
 * `new URL(path, base)` 在 base 末尾有没有 `/` 时行为不同，容易拼错路径（少一段或多一段）。
 * 这里统一把 base 归一化后再拼路径，确保 callback / authorizeUrl 拼接稳定。
 */

/**
 * 把 base URL 归一化：去除末尾的 `/`，保证后续以 `/` 开头拼接。
 * 例如：
 *   "http://h:3000/" → "http://h:3000"
 *   "http://h:3000"  → "http://h:3000"
 */
export function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("base url is required");
  }
  return trimmed.replace(/\/+$/, "");
}

/**
 * 在 base 后拼接路径。
 * - base 末尾的 `/` 会被去掉。
 * - path 必须以 `/` 开头，否则视为相对根追加 `/`。
 *
 * 例如：
 *   joinUrl("http://h:3000/", "/api/auth/sso/callback") → "http://h:3000/api/auth/sso/callback"
 *   joinUrl("http://h:3000",  "api/auth/sso/callback")   → "http://h:3000/api/auth/sso/callback"
 */
export function joinUrl(base: string, path: string): string {
  const normalizedBase = normalizeBaseUrl(base);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

/**
 * 把 query 参数附加到 URL 上。
 * 已存在的 query 会被保留（以 & 追加）。
 *
 * 例如：
 *   appendQuery("http://h/a", { b: "2", c: "x y" }) → "http://h/a?b=2&c=x+y"
 *   appendQuery("http://h/a?z=1", { b: "2" })       → "http://h/a?z=1&b=2"
 */
export function appendQuery(
  url: string,
  params: Record<string, string | string[]>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        search.append(key, item);
      }
    } else {
      search.append(key, value);
    }
  }
  const query = search.toString();
  if (!query) {
    return url;
  }
  return url.includes("?") ? `${url}&${query}` : `${url}?${query}`;
}

/**
 * 从 URL 中提取 path（去掉 origin），便于把 SSO 绝对 Location 改写成同域相对路径。
 * 例如：
 *   "http://sso-host:19210/auth/login?x=1" → "/auth/login?x=1"
 * 仅在 URL 是合法 http(s) URL 时转换；已经是相对路径的直接返回。
 */
export function toRelativePathOrSame(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    return path || "/";
  } catch {
    return trimmed;
  }
}

/**
 * returnTo 安全过滤（playbook 坑 6 / 13.6）。
 * 只允许 hash 或站内相对路径（`/` 开头且不是 `//`），拒绝开放跳转：
 *   - `javascript:...`、`data:...`
 *   - `//evil.com`（协议相对）
 *   - `http://evil.com`、`https://...`
 *   - 路径穿越（不强制，但 `..` 也不应跳到站外）
 *
 * 返回归一化后的安全 returnTo；非法时回退到 fallback。
 */
export function sanitizeReturnTo(raw: string | undefined | null, fallback = "/admin"): string {
  if (!raw) {
    return fallback;
  }
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return fallback;
  }
  // 允许 hash（#xxx）
  if (value.startsWith("#")) {
    return value;
  }
  // 必须是 / 开头且不是 //（协议相对）
  if (!value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  // 拒绝显式协议伪装，如 "/\\evil.com" 或 "/javascript:..."
  if (/(javascript|data|vbscript):/i.test(value)) {
    return fallback;
  }
  return value;
}
