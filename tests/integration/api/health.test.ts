import test from "node:test";
import assert from "node:assert/strict";

import { GET } from "../../../apps/web/app/api/health/route.ts";

test("GET /api/health 返回 200 且包含 status: ok", async () => {
  const response = await GET();
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.status, "ok");
});
