import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeBaseUrl,
  joinUrl,
  appendQuery,
  toRelativePathOrSame,
  sanitizeReturnTo,
} from "../../../../apps/web/lib/auth/sso/url-helper.ts";

// ---- normalizeBaseUrl ----

test("normalizeBaseUrl: 去除末尾单个 /", () => {
  assert.equal(normalizeBaseUrl("http://h:3000/"), "http://h:3000");
});

test("normalizeBaseUrl: 去除末尾多个 /", () => {
  assert.equal(normalizeBaseUrl("http://h:3000///"), "http://h:3000");
});

test("normalizeBaseUrl: 无末尾 / 保持不变", () => {
  assert.equal(normalizeBaseUrl("http://h:3000"), "http://h:3000");
});

test("normalizeBaseUrl: 空串抛错（坑 8：base 不能为空）", () => {
  assert.throws(() => normalizeBaseUrl(""), /base url is required/);
  assert.throws(() => normalizeBaseUrl("   "), /base url is required/);
});

// ---- joinUrl ----

test("joinUrl: base 带末尾 / + path 带 / 前缀", () => {
  assert.equal(
    joinUrl("http://h:3000/", "/api/auth/sso/callback"),
    "http://h:3000/api/auth/sso/callback",
  );
});

test("joinUrl: base 无末尾 / + path 无 / 前缀", () => {
  assert.equal(
    joinUrl("http://h:3000", "api/auth/sso/callback"),
    "http://h:3000/api/auth/sso/callback",
  );
});

test("joinUrl: 不会因 new URL 的 base 末尾 / 行为差异拼错（坑 8 核心）", () => {
  // 对照：直接用 new URL 在 base 带末尾 / 时会丢掉最后一段
  // 这里 joinUrl 必须稳定拼接，不丢段
  const withSlash = joinUrl("http://h:3000/", "/auth/oauth2/authorize");
  const noSlash = joinUrl("http://h:3000", "/auth/oauth2/authorize");
  assert.equal(withSlash, noSlash);
  assert.equal(withSlash, "http://h:3000/auth/oauth2/authorize");
});

// ---- appendQuery ----

test("appendQuery: 无已有 query 时加 ?", () => {
  assert.equal(
    appendQuery("http://h/a", { b: "2", c: "x y" }),
    "http://h/a?b=2&c=x+y",
  );
});

test("appendQuery: 已有 query 时用 & 追加", () => {
  assert.equal(
    appendQuery("http://h/a?z=1", { b: "2" }),
    "http://h/a?z=1&b=2",
  );
});

test("appendQuery: 数组值展开为多个同名参数（如 scope）", () => {
  assert.equal(
    appendQuery("http://h/a", { scope: ["openid", "profile"] }),
    "http://h/a?scope=openid&scope=profile",
  );
});

test("appendQuery: 空参数对象返回原 url", () => {
  assert.equal(appendQuery("http://h/a", {}), "http://h/a");
});

// ---- toRelativePathOrSame ----

test("toRelativePathOrSame: 绝对 URL 提取 path+search+hash（代理改写 Location，坑 13.8）", () => {
  assert.equal(
    toRelativePathOrSame("http://sso-host:19210/auth/login?continue=1#frag"),
    "/auth/login?continue=1#frag",
  );
});

test("toRelativePathOrSame: 已是相对路径直接返回", () => {
  assert.equal(toRelativePathOrSame("/auth/login?x=1"), "/auth/login?x=1");
});

test("toRelativePathOrSame: 非法 URL 字符串原样返回（不抛错）", () => {
  assert.equal(toRelativePathOrSame("not-a-url"), "not-a-url");
});

// ---- sanitizeReturnTo（防开放跳转，坑 6 / 13.6） ----

test("sanitizeReturnTo: 默认回退 /admin", () => {
  assert.equal(sanitizeReturnTo(undefined), "/admin");
  assert.equal(sanitizeReturnTo(""), "/admin");
  assert.equal(sanitizeReturnTo("   "), "/admin");
  assert.equal(sanitizeReturnTo(null), "/admin");
});

test("sanitizeReturnTo: 站内相对路径放行", () => {
  assert.equal(sanitizeReturnTo("/admin"), "/admin");
  assert.equal(sanitizeReturnTo("/admin/create"), "/admin/create");
});

test("sanitizeReturnTo: hash 放行", () => {
  assert.equal(sanitizeReturnTo("#section"), "#section");
});

test("sanitizeReturnTo: 拒绝协议相对 //evil.com", () => {
  assert.equal(sanitizeReturnTo("//evil.com/path"), "/admin");
});

test("sanitizeReturnTo: 拒绝 javascript: 协议（含伪装 /javascript:）", () => {
  assert.equal(sanitizeReturnTo("javascript:alert(1)"), "/admin");
  assert.equal(sanitizeReturnTo("/javascript:alert(1)"), "/admin");
});

test("sanitizeReturnTo: 拒绝 data: 协议", () => {
  assert.equal(sanitizeReturnTo("data:text/html,xxx"), "/admin");
});

test("sanitizeReturnTo: 拒绝绝对 http(s) URL", () => {
  assert.equal(sanitizeReturnTo("http://evil.com/"), "/admin");
  assert.equal(sanitizeReturnTo("https://evil.com/"), "/admin");
});

test("sanitizeReturnTo: 自定义 fallback 生效", () => {
  assert.equal(sanitizeReturnTo("http://evil.com/", "/home"), "/home");
});
