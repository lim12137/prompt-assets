import { randomUUID } from "node:crypto";

/**
 * SSO 登录页 HTML 代理改写（playbook 坑 10/11、§13.8）。
 *
 * SSO 登录页是第三方 HTML，依赖内联 <style>/<script>。直接代理会被浏览器 CSP 拦截。
 * 这里统一处理：
 * 1. 删 Google Fonts（内网访问不到）
 * 2. 给所有 <style>/<script> 加 nonce
 * 3. 改写找回密码接口为 SSO origin 绝对地址（避免落到应用域）
 * 4. 改写 CSP 响应头（补 style-src/script-src nonce，不用 unsafe-inline）
 *
 * 注意：HTML 改写后 body 长度变化，调用方必须删 content-length（见 rewriteResponseHeaders）。
 */

/**
 * 改写 SSO 登录页 HTML body。
 *
 * @param html 原始 HTML 文本
 * @param ssoOrigin SSO origin（用于找回密码接口改绝对地址），如 "http://sso:19210"
 * @param nonce 可选；不传则内部生成。便于测试传入固定值。
 * @returns { html, nonce } 改写后的 HTML 与使用的 nonce
 */
export function rewriteSsoHtml(
  html: string,
  ssoOrigin: string,
  nonce?: string,
): { html: string; nonce: string } {
  const usedNonce = nonce ?? randomUUID();
  let result = html;

  // 1. 删 Google Fonts link（内网访问不到，导致页面卡顿/报错）
  result = removeGoogleFontsLinks(result);

  // 2. 给所有 <style> 加 nonce（若无）
  result = addNonceToStyleTags(result, usedNonce);

  // 3. 给所有 <script> 加 nonce（若无）
  result = addNonceToScriptTags(result, usedNonce);

  // 4. 改写找回密码接口为 SSO origin 绝对地址
  result = rewriteForgotPasswordUrls(result, ssoOrigin);

  return { html: result, nonce: usedNonce };
}

/**
 * 删除 Google Fonts <link>（playbook §13.8 表：内网访问外部字体被阻断）。
 * 匹配 <link ... href="https://fonts.googleapis.com/..." ...>
 */
export function removeGoogleFontsLinks(html: string): string {
  return html.replace(/<link\b[^>]*fonts\.googleapis\.com[^>]*>/gi, "");
}

/**
 * 给所有 <style> 标签加 nonce 属性（若没有）。
 * 匹配 <style> 和 <style ...>，注入 nonce="..."。
 */
export function addNonceToStyleTags(html: string, nonce: string): string {
  return html.replace(/<style\b([^>]*?)>/gi, (match, attrs: string) => {
    if (/\bnonce=/i.test(attrs)) {
      return match; // 已有 nonce，不动
    }
    return `<style${attrs} nonce="${nonce}">`;
  });
}

/**
 * 给所有 <script> 标签加 nonce 属性（若没有）。
 */
export function addNonceToScriptTags(html: string, nonce: string): string {
  return html.replace(/<script\b([^>]*?)>/gi, (match, attrs: string) => {
    if (/\bnonce=/i.test(attrs)) {
      return match;
    }
    return `<script${attrs} nonce="${nonce}">`;
  });
}

/**
 * 改写找回密码接口为 SSO origin 绝对地址（playbook 坑 11）。
 *
 * SSO HTML 脚本里调用 /system/forgotPassword/sendCode、/system/forgotPassword/reset，
 * 相对路径会落到应用域。改成 ${ssoOrigin}/system/forgotPassword/... 绝对地址直连 SSO。
 *
 * 匹配场景：
 *   action="/system/forgotPassword/sendCode"
 *   fetch("/system/forgotPassword/reset")
 *   url: '/system/forgotPassword/sendCode'
 */
export function rewriteForgotPasswordUrls(html: string, ssoOrigin: string): string {
  const normalizedOrigin = ssoOrigin.replace(/\/+$/, "");
  // 只改以 / 开头的（相对路径）；已经是绝对 URL 的不动
  return html.replace(
    /(["'`(])\/system\/forgotPassword\/(sendCode|reset)/gi,
    (_match, quote: string, path: string) => `${quote}${normalizedOrigin}/system/forgotPassword/${path}`,
  );
}

/**
 * 改写响应头（playbook §6.3）：
 * - 删 content-length（body 被改写，长度变了）
 * - 删原有 CSP（避免与下面注入的冲突）
 * 返回改写后的 headers 副本 + 需要补充的 CSP 片段。
 */
export function rewriteResponseHeaders(
  originalHeaders: Headers,
  nonce: string,
): { headers: Record<string, string>; csp: string } {
  const headers: Record<string, string> = {};
  for (const [key, value] of originalHeaders.entries()) {
    const lower = key.toLowerCase();
    // 删 content-length（body 改写后失效）
    if (lower === "content-length") {
      continue;
    }
    // 删原有 CSP，后面用新的替换
    if (lower === "content-security-policy") {
      continue;
    }
    headers[key] = value;
  }
  const csp = buildCspHeader(nonce);
  headers["content-security-policy"] = csp;
  return { headers, csp };
}

/**
 * 构建 CSP 响应头：补 style-src/script-src nonce，不用 unsafe-inline。
 * default-src 'self' 保证基础策略。
 */
export function buildCspHeader(nonce: string): string {
  return [
    "default-src 'self'",
    `style-src 'self' 'nonce-${nonce}'`,
    `script-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
  ].join("; ");
}

/**
 * 把 SSO 302 的绝对 Location 改写成同域相对路径（playbook §6.5）。
 * 例如 "http://sso:19210/auth/login?x=1" → "/auth/login?x=1"
 * 已经是相对路径的直接返回。
 */
export function rewriteLocationHeader(location: string | null): string | null {
  if (!location) {
    return null;
  }
  const trimmed = location.trim();
  if (trimmed.startsWith("/")) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return trimmed;
  }
}
