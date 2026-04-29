import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLoginCookie,
  signLoginToken,
  verifyLoginToken,
  parseWhitelistSettingsFromEnv,
  resolveManageFlags,
} from "../../../apps/web/lib/auth/session.ts";

test("sign/verify: 有效 token 可通过校验", () => {
  const token = signLoginToken(
    {
      uid: "u1001",
      name: "Alice",
      can_manage: true,
      can_manage_whitelist: false,
    },
    {
      secret: "test-secret",
      ttlMinutes: 10,
      now: new Date("2026-04-29T00:00:00.000Z"),
      nonce: "n1",
    },
  );
  const verified = verifyLoginToken(token, {
    secret: "test-secret",
    now: new Date("2026-04-29T00:05:00.000Z"),
  });

  assert.equal(verified.ok, true);
  if (verified.ok) {
    assert.equal(verified.user.uid, "u1001");
    assert.equal(verified.user.can_manage, true);
  }
});

test("verify: 篡改 token 会失败", () => {
  const token = signLoginToken(
    {
      uid: "u1002",
      name: "Bob",
      can_manage: true,
      can_manage_whitelist: true,
    },
    { secret: "test-secret", ttlMinutes: 10, nonce: "n2" },
  );
  const tampered = `${token}x`;
  const verified = verifyLoginToken(tampered, { secret: "test-secret" });
  assert.equal(verified.ok, false);
});

test("verify: 过期 token 会失败", () => {
  const token = signLoginToken(
    {
      uid: "u1003",
      name: "Carol",
      can_manage: true,
      can_manage_whitelist: false,
    },
    {
      secret: "test-secret",
      ttlMinutes: 1,
      now: new Date("2026-04-29T00:00:00.000Z"),
      nonce: "n3",
    },
  );
  const verified = verifyLoginToken(token, {
    secret: "test-secret",
    now: new Date("2026-04-29T00:02:00.000Z"),
  });
  assert.equal(verified.ok, false);
});

test("verify: secret 缺失时报错", () => {
  assert.throws(
    () =>
      signLoginToken(
        {
          uid: "u1004",
          name: "Dave",
          can_manage: false,
          can_manage_whitelist: false,
        },
        { secret: "" },
      ),
    /LOGIN_TOKEN_SECRET/i,
  );
});

test("白名单权限: 可由 env 控制管理权限", () => {
  const settings = parseWhitelistSettingsFromEnv({
    WHITELIST_ENABLED: "true",
    WHITELIST_DEFAULT_IDS: "u1001,u1002",
    WHITELIST_DEFAULT_NAMES: "Alice,Bob",
    WHITELIST_ADMIN_USER_IDS: "u1001",
    WHITELIST_ADMIN_USER_NAMES: "Alice",
  });
  const alice = resolveManageFlags(
    { uid: "u1001", name: "Alice" },
    settings,
  );
  const bob = resolveManageFlags(
    { uid: "u1002", name: "Bob" },
    settings,
  );
  const eve = resolveManageFlags(
    { uid: "u9999", name: "Eve" },
    settings,
  );

  assert.equal(alice.can_manage, true);
  assert.equal(alice.can_manage_whitelist, true);
  assert.equal(bob.can_manage, true);
  assert.equal(bob.can_manage_whitelist, false);
  assert.equal(eve.can_manage, false);
});

test("白名单权限: 未开启时默认拒绝管理权限（fail-closed）", () => {
  const settings = parseWhitelistSettingsFromEnv({});
  const result = resolveManageFlags({ uid: "u2001", name: "NormalUser" }, settings);
  assert.equal(result.can_manage, false);
  assert.equal(result.can_manage_whitelist, false);
});

test("生产环境登录 cookie 默认带 Secure", () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldCookieSecure = process.env.LOGIN_COOKIE_SECURE;
  process.env.NODE_ENV = "production";
  delete process.env.LOGIN_COOKIE_SECURE;
  try {
    const cookie = buildLoginCookie("token-value");
    assert.match(cookie, /;\s*Secure(?:;|$)/i);
  } finally {
    process.env.NODE_ENV = oldNodeEnv;
    process.env.LOGIN_COOKIE_SECURE = oldCookieSecure;
  }
});
