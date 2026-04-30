import test from "node:test";
import assert from "node:assert/strict";

import { POST } from "../../../apps/web/app/api/login/route.ts";
import { __setOaClientForTests } from "../../../apps/web/lib/auth/oa-client.ts";

test.afterEach(() => {
  __setOaClientForTests(null);
  delete process.env.LOGIN_TOKEN_SECRET;
  delete process.env.WHITELIST_ENABLED;
});

test("login route: password_encrypted 只向 OA 转发 primitive 值", async () => {
  process.env.LOGIN_TOKEN_SECRET = "test-secret";
  process.env.WHITELIST_ENABLED = "false";
  let receivedPasswordEncrypted: unknown = "not-called";
  __setOaClientForTests(async (input) => {
    receivedPasswordEncrypted = input.passwordEncrypted;
    return {
      ok: true,
      userInfo: {
        id: input.username,
        name: "Alice",
      },
    };
  });

  const response = await POST(
    new Request("http://localhost/api/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: "alice",
        password: "password",
        password_encrypted: { enabled: true },
      }),
    }),
  );

  assert.equal(response.status, 200);
  assert.equal(receivedPasswordEncrypted, undefined);
});
