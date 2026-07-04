import test from "node:test";
import assert from "node:assert/strict";

import {
  rewriteSsoHtml,
  removeGoogleFontsLinks,
  addNonceToStyleTags,
  addNonceToScriptTags,
  rewriteForgotPasswordUrls,
  rewriteResponseHeaders,
  buildCspHeader,
  rewriteLocationHeader,
} from "../../../../apps/web/lib/auth/sso/proxy-html.ts";

const NONCE = "abc-123-nonce";
const SSO_ORIGIN = "http://sso:19210";

// ---- removeGoogleFontsLinks ----

test("removeGoogleFontsLinks: 删除 googleapis 字体 link", () => {
  const html = `<head><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto"></head>`;
  assert.equal(removeGoogleFontsLinks(html), `<head></head>`);
});

test("removeGoogleFontsLinks: 保留其它 link（如本系统样式）", () => {
  const html = `<link rel="stylesheet" href="/css/app.css"><link href="https://fonts.googleapis.com/x">`;
  const result = removeGoogleFontsLinks(html);
  assert.ok(result.includes("/css/app.css"));
  assert.ok(!result.includes("googleapis"));
});

test("removeGoogleFontsLinks: 无字体 link 时原样返回", () => {
  const html = `<div>hello</div>`;
  assert.equal(removeGoogleFontsLinks(html), html);
});

// ---- addNonceToStyleTags ----

test("addNonceToStyleTags: 给 <style> 加 nonce", () => {
  const html = `<style>.x{color:red}</style>`;
  const result = addNonceToStyleTags(html, NONCE);
  assert.ok(result.includes(`<style nonce="${NONCE}">`));
});

test("addNonceToStyleTags: 给带属性的 <style class=...> 加 nonce", () => {
  const html = `<style class="scoped">.x{}</style>`;
  const result = addNonceToStyleTags(html, NONCE);
  assert.ok(result.includes(`nonce="${NONCE}"`));
  assert.ok(result.includes(`class="scoped"`));
});

test("addNonceToStyleTags: 已有 nonce 的不重复加", () => {
  const html = `<style nonce="existing">.x{}</style>`;
  const result = addNonceToStyleTags(html, NONCE);
  assert.ok(result.includes(`nonce="existing"`));
  assert.ok(!result.includes(NONCE));
});

// ---- addNonceToScriptTags ----

test("addNonceToScriptTags: 给 <script> 加 nonce", () => {
  const html = `<script>alert(1)</script>`;
  const result = addNonceToScriptTags(html, NONCE);
  assert.ok(result.includes(`<script nonce="${NONCE}">`));
});

test("addNonceToScriptTags: 给带 src 的 <script src=...> 加 nonce", () => {
  const html = `<script src="/js/app.js"></script>`;
  const result = addNonceToScriptTags(html, NONCE);
  assert.ok(result.includes(`nonce="${NONCE}"`));
  assert.ok(result.includes(`src="/js/app.js"`));
});

test("addNonceToScriptTags: 已有 nonce 的不重复加", () => {
  const html = `<script nonce="old">x</script>`;
  const result = addNonceToScriptTags(html, NONCE);
  assert.ok(result.includes(`nonce="old"`));
  assert.ok(!result.includes(NONCE));
});

// ---- rewriteForgotPasswordUrls ----

test("rewriteForgotPasswordUrls: action=/system/forgotPassword/sendCode 改绝对地址", () => {
  const html = `<form action="/system/forgotPassword/sendCode">`;
  const result = rewriteForgotPasswordUrls(html, SSO_ORIGIN);
  assert.ok(result.includes(`action="http://sso:19210/system/forgotPassword/sendCode"`));
});

test("rewriteForgotPasswordUrls: fetch('/system/forgotPassword/reset') 改绝对地址", () => {
  const html = `fetch('/system/forgotPassword/reset')`;
  const result = rewriteForgotPasswordUrls(html, SSO_ORIGIN);
  assert.ok(result.includes(`fetch('http://sso:19210/system/forgotPassword/reset')`));
});

test("rewriteForgotPasswordUrls: 双引号也处理", () => {
  const html = `fetch("/system/forgotPassword/sendCode")`;
  const result = rewriteForgotPasswordUrls(html, SSO_ORIGIN);
  assert.ok(result.includes(`fetch("http://sso:19210/system/forgotPassword/sendCode")`));
});

test("rewriteForgotPasswordUrls: 已是绝对 URL 的不动", () => {
  const html = `fetch("http://other/system/forgotPassword/sendCode")`;
  const result = rewriteForgotPasswordUrls(html, SSO_ORIGIN);
  // http://other 是绝对 URL，但正则匹配的是 quote + /system，这里 quote 后是 http 不是 /
  // 所以不会被改写（因为正则要求 quote 后紧跟 /system）
  assert.equal(result, html);
});

test("rewriteForgotPasswordUrls: 非找回密码的 /system 接口不动（精确路径）", () => {
  const html = `fetch("/system/user/getInfo")`;
  const result = rewriteForgotPasswordUrls(html, SSO_ORIGIN);
  assert.equal(result, html);
});

test("rewriteForgotPasswordUrls: SSO origin 末尾 / 被归一化", () => {
  const html = `<form action="/system/forgotPassword/sendCode">`;
  const result = rewriteForgotPasswordUrls(html, "http://sso:19210/");
  assert.ok(result.includes("http://sso:19210/system/forgotPassword/sendCode"));
  assert.ok(!result.includes("19210//system"));
});

// ---- rewriteSsoHtml（集成） ----

test("rewriteSsoHtml: 完整改写（fonts+nonce+forgotPassword）", () => {
  const html = `
    <head>
      <link href="https://fonts.googleapis.com/css?family=X" rel="stylesheet">
      <style>.x{color:red}</style>
    </head>
    <body>
      <script>function sendCode(){fetch('/system/forgotPassword/sendCode')}</script>
      <style class="inline">.y{}</style>
    </body>`;
  const { html: result, nonce } = rewriteSsoHtml(html, SSO_ORIGIN, NONCE);
  assert.equal(nonce, NONCE);
  // fonts 删除
  assert.ok(!result.includes("googleapis"));
  // 两个 style + 一个 script 都加了 nonce（共 3 处）
  assert.equal((result.match(new RegExp(`nonce="${NONCE}"`, "g")) || []).length, 3);
  // script 加了 nonce
  assert.ok(result.includes(`<script nonce="${NONCE}">`));
  // 找回密码改绝对地址
  assert.ok(result.includes("http://sso:19210/system/forgotPassword/sendCode"));
});

test("rewriteSsoHtml: 不传 nonce 时自动生成", () => {
  const { nonce } = rewriteSsoHtml("<style>x</style>", SSO_ORIGIN);
  assert.ok(typeof nonce === "string");
  assert.ok(nonce.length > 0);
  assert.notEqual(nonce, NONCE);
});

// ---- buildCspHeader ----

test("buildCspHeader: 含 default-src style-src script-src nonce，无 unsafe-inline", () => {
  const csp = buildCspHeader(NONCE);
  assert.ok(csp.includes("default-src 'self'"));
  assert.ok(csp.includes(`style-src 'self' 'nonce-${NONCE}'`));
  assert.ok(csp.includes(`script-src 'self' 'nonce-${NONCE}'`));
  assert.ok(!csp.includes("unsafe-inline"));
});

// ---- rewriteResponseHeaders ----

test("rewriteResponseHeaders: 删 content-length", () => {
  const headers = new Headers({
    "content-type": "text/html",
    "content-length": "9999",
    "x-custom": "keep",
  });
  const { headers: result } = rewriteResponseHeaders(headers, NONCE);
  assert.equal(result["content-length"], undefined);
  assert.equal(result["x-custom"], "keep");
});

test("rewriteResponseHeaders: 删原 CSP，注入新 CSP", () => {
  const headers = new Headers({
    "content-security-policy": "default-src 'none'",
    "content-type": "text/html",
  });
  const { headers: result, csp } = rewriteResponseHeaders(headers, NONCE);
  assert.equal(result["content-security-policy"], csp);
  assert.ok(!csp.includes("default-src 'none'"));
  assert.ok(csp.includes(`nonce-${NONCE}`));
});

test("rewriteResponseHeaders: 保留其它头（set-cookie 等）", () => {
  const headers = new Headers({
    "content-type": "text/html",
    "set-cookie": "JSESSIONID=abc; Path=/auth",
  });
  const { headers: result } = rewriteResponseHeaders(headers, NONCE);
  assert.equal(result["set-cookie"], "JSESSIONID=abc; Path=/auth");
});

// ---- rewriteLocationHeader ----

test("rewriteLocationHeader: 绝对 URL 改同域相对路径", () => {
  assert.equal(
    rewriteLocationHeader("http://sso:19210/auth/login?continue=1"),
    "/auth/login?continue=1",
  );
});

test("rewriteLocationHeader: 已是相对路径直接返回", () => {
  assert.equal(rewriteLocationHeader("/auth/login"), "/auth/login");
});

test("rewriteLocationHeader: null 返回 null", () => {
  assert.equal(rewriteLocationHeader(null), null);
});

test("rewriteLocationHeader: 保留 hash", () => {
  assert.equal(
    rewriteLocationHeader("http://sso/auth/callback#frag"),
    "/auth/callback#frag",
  );
});

test("rewriteLocationHeader: 非法 URL 原样返回", () => {
  assert.equal(rewriteLocationHeader("not-a-url"), "not-a-url");
});
