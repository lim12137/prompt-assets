import { NextResponse } from "next/server.js";

import { loadSsoConfig } from "../../../lib/auth/sso/sso-config.ts";
import {
  rewriteSsoHtml,
  rewriteResponseHeaders,
  rewriteLocationHeader,
} from "../../../lib/auth/sso/proxy-html.ts";
import { joinUrl } from "../../../lib/auth/sso/url-helper.ts";

/**
 * 同域代理 catch-all：把 /auth/* 代理到 SSO origin（playbook §6、§13.7）。
 *
 * 这是大退和第三方登录页体验的基础设施：
 * - 登录、authorize、logout 走同一浏览器域名 → SSO HttpOnly Cookie 能被清理。
 * - /auth/login 页面 CSS/JS 经 HTML 改写后同域可用。
 *
 * 代理范围：/auth/* → ${SSO_ORIGIN}/auth/*
 * 不代理 /api/*、/system/*（找回密码已在 HTML 改写为 SSO origin 绝对地址直连）。
 */

type Context = {
  params: Promise<{ path?: string[] }>;
};

export async function GET(request: Request, context: Context): Promise<Response> {
  return proxyRequest(request, context, "GET");
}

export async function POST(request: Request, context: Context): Promise<Response> {
  return proxyRequest(request, context, "POST");
}

async function proxyRequest(
  request: Request,
  context: Context,
  method: string,
): Promise<Response> {
  const config = loadSsoConfig();
  if (!config.enabled) {
    return NextResponse.json(
      { error: "sso proxy disabled", code: "sso_disabled" },
      { status: 404 },
    );
  }

  const { path: pathSegments } = await context.params;
  const path = pathSegments && pathSegments.length > 0 ? `/${pathSegments.join("/")}` : "/";
  const requestUrl = new URL(request.url);
  const targetUrl = joinUrl(config.ssoOrigin, `/auth${path}`) + requestUrl.search;

  const forwardHeaders: Record<string, string> = {};
  const passthrough = ["content-type", "accept", "cookie", "authorization"];
  for (const key of passthrough) {
    const value = request.headers.get(key);
    if (value) {
      forwardHeaders[key] = value;
    }
  }

  const init: RequestInit = {
    method,
    headers: forwardHeaders,
    ...(method !== "GET" && method !== "HEAD" ? { body: await request.text() } : {}),
    redirect: "manual",
  };

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, init);
  } catch (err) {
    return NextResponse.json(
      {
        error: "sso upstream unreachable",
        code: "upstream_unreachable",
        message: err instanceof Error ? err.message : undefined,
      },
      { status: 502 },
    );
  }

  // 浏览器访问本应用域的 origin（用于把 SSO 相对 Location 拼成同域绝对 URL）。
  // 不能用 requestUrl.origin——当 dev server 用 --hostname 0.0.0.0 启动时，
  // request.url 的 host 会是 0.0.0.0 而不是浏览器真实访问的 host。
  // 从 Host 头（或反代后的 x-forwarded-host）取浏览器真实访问的地址。
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    requestUrl.host;
  // 归一化 protocol：确保带冒号（x-forwarded-proto 可能是 "http" 或 "https"，不带冒号）
  const rawProto = request.headers.get("x-forwarded-proto") || requestUrl.protocol;
  const proto = rawProto.endsWith(":") ? rawProto : `${rawProto}:`;
  const requestOrigin = `${proto}//${host}`;
  return rewriteProxyResponse(upstreamResponse, config.ssoOrigin, requestOrigin);
}

async function rewriteProxyResponse(
  upstream: Response,
  ssoOrigin: string,
  requestOrigin: string,
): Promise<Response> {
  const contentType = upstream.headers.get("content-type") ?? "";

  if (upstream.status >= 300 && upstream.status < 400) {
    const relativeLocation = rewriteLocationHeader(upstream.headers.get("location"));
    const { headers } = rewriteResponseHeaders(upstream.headers, randomNonce());
    // NextResponse.redirect 需要绝对 URL；用浏览器访问的应用域 origin 拼同域绝对地址
    const absoluteLocation = relativeLocation
      ? `${requestOrigin}${relativeLocation}`
      : `${requestOrigin}/`;
    const response = NextResponse.redirect(absoluteLocation, { status: upstream.status });
    for (const [key, value] of Object.entries(headers) as Array<[string, string]>) {
      response.headers.set(key, value);
    }
    response.headers.set("location", absoluteLocation);
    return response;
  }

  if (contentType.includes("text/html")) {
    const originalHtml = await upstream.text();
    const { html, nonce } = rewriteSsoHtml(originalHtml, ssoOrigin);
    const { headers } = rewriteResponseHeaders(upstream.headers, nonce);
    return new Response(html, {
      status: upstream.status,
      headers,
    });
  }

  const body = await upstream.arrayBuffer();
  const headers: Record<string, string> = {};
  for (const [key, value] of upstream.headers.entries()) {
    if (key.toLowerCase() !== "content-length") {
      headers[key] = value;
    }
  }
  headers["content-length"] = String(body.byteLength);
  return new Response(body, { status: upstream.status, headers });
}

function randomNonce(): string {
  return cryptoRandomUuid();
}

function cryptoRandomUuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return g.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}
