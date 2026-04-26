import test from "node:test";
import assert from "node:assert/strict";

import {
  reclaimWebPortIfNeeded,
  resolveLocalDebugConfig,
} from "../../../scripts/local-debug.mjs";

const config = resolveLocalDebugConfig({});

test("reclaimWebPortIfNeeded kills old project web and continues", async () => {
  const calls = [];
  await reclaimWebPortIfNeeded(config, {
    listListeners: () => [{ pid: "1200", commandLine: "...@prompt-management/web dev --port 3010" }],
    killPid: (pid) => calls.push(pid),
  });

  assert.deepEqual(calls, ["1200"]);
});

test("reclaimWebPortIfNeeded throws when unknown listener exists", async () => {
  await assert.rejects(
    () =>
      reclaimWebPortIfNeeded(config, {
        listListeners: () => [{ pid: "7777", commandLine: "python -m http.server 3010" }],
        killPid: () => assert.fail("must not kill unknown process"),
      }),
    /Refusing to stop unknown process/i,
  );
});
