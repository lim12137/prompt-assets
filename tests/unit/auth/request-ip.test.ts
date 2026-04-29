import test from "node:test";
import assert from "node:assert/strict";

import { getBusinessDateKey, getRequestIp } from "../../../apps/web/lib/auth/request-ip.ts";

test("getRequestIp 优先取 x-forwarded-for 首个 IP", () => {
  const request = new Request("http://localhost:3000", {
    headers: {
      "x-forwarded-for": " 203.0.113.5 , 10.0.0.1",
      "x-real-ip": "198.51.100.7",
    },
  });
  assert.equal(getRequestIp(request), "203.0.113.5");
});

test("getRequestIp x-forwarded-for 缺失时回退 x-real-ip", () => {
  const request = new Request("http://localhost:3000", {
    headers: {
      "x-real-ip": "198.51.100.7",
    },
  });
  assert.equal(getRequestIp(request), "198.51.100.7");
});

test("getRequestIp 都缺失返回 unknown", () => {
  const request = new Request("http://localhost:3000");
  assert.equal(getRequestIp(request), "unknown");
});

test("getBusinessDateKey 按 Asia/Shanghai 跨天切换", () => {
  assert.equal(
    getBusinessDateKey(new Date("2026-04-29T15:59:59.000Z")),
    "2026-04-29",
  );
  assert.equal(
    getBusinessDateKey(new Date("2026-04-29T16:00:00.000Z")),
    "2026-04-30",
  );
});

