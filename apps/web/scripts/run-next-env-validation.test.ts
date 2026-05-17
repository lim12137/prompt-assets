import test from "node:test";
import assert from "node:assert/strict";

import { validateAppEnvForTest } from "./run-next.mjs";

test("run-next 启动前应校验首页 AI 工具 env", async () => {
  await assert.rejects(
    () =>
      validateAppEnvForTest({
        DATABASE_URL: "postgres://user:pass@localhost:5432/prompt_db",
        AI_TOOLS: "chatgpt,claude,custom-tool",
      }),
    /AI_TOOL_CUSTOM_TOOL_NAME/,
  );
});
