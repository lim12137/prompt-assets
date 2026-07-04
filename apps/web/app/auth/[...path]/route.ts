import { NextResponse } from "next/server.js";

import { loadSsoConfig } from "../../../../lib/auth/sso/sso-config.ts";
import {
  rewriteSsoHtml,
  rewriteResponseHeaders,
  rewriteLocationHeader,
} from "../../../../lib/auth/sso/proxy-html.ts";
import { joinUrl } from "../../../../lib/auth/sso/url-helper.ts";

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
  // 保留 query string
  const requestUrl = new URL(request.url);
  const targetUrl = joinUrl(config.ssoOrigin, `/auth${path}`) + requestUrl.search;

  // 转发请求头：透传必要的头，去掉 host（fetch 会自动设）
  const forwardHeaders: Record<string, string> = {};
  const passthrough = ["content-type", "accept", "cookie", "authorization"];
  for (const key of passthrough) {
    const value = request.headers.get(key);
    if (value) {
      forwardHeaders[key] = value;
    }
  }

  // 转发 body（POST 时）
  const init: RequestInit = {
    method,
    headers: forwardHeaders,
    ...(method !== "GET" && method !== "HEAD" ? { body: await request.text() } : {}),
    // 代理不跟随重定向，由本路由改写 Location 后返回给浏览器
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

  return rewriteProxyResponse(upstreamResponse, config.ssoOrigin);
}

/**
 * 改写代理响应：
 * - 3xx 重定向：改写 Location 为同域相对路径
 * - text/html：HTML body 改写（nonce/fonts/forgotPassword）+ CSP
 * - 其它：透传（仅删 content-length 一致性）
 */
async function rewriteProxyResponse(
  upstream: Response,
  ssoOrigin: string,
): Promise<Response> {
  const contentType = upstream.headers.get("content-type") ?? "";

  // 3xx：改写 Location
  if (upstream.status >= 300 && upstream.status < 400) {
    const location = rewriteLocationHeader(upstream.headers.get("location"));
    const { headers } = rewriteResponseHeaders(upstream.headers, randomNonce());
    const response = NextResponse.redirect(location ?? "/", { status: upstream.status });
    for (const [key, value] of Object.entries(headers)) {
      response.headers.set(key, value);
    }
    if (location) {
      response.headers.set("location", location);
    }
    return response;
  }

  // text/html：改写 body
  if (contentType.includes("text/html")) {
    const originalHtml = await upstream.text();
    const { html, nonce } = rewriteSsoHtml(originalHtml, ssoOrigin);
    const { headers } = rewriteResponseHeaders(upstream.headers, nonce);
    return new Response(html, {
      status: upstream.status,
      headers,
    });
  }

  // 其它（JSON/静态资源）：透传，删 content-length（一致性；非必须但无害）
  const body = await upstream.arrayBuffer();
  const headers: Record<string, string> = {};
  for (const [key, value] of upstream.headers.entries()) {
    if (key.toLowerCase() !== "content-length") {
      headers[key] = value;
    }
  }
  // 重新计算 content-length
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
