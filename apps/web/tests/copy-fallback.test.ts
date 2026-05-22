import test from "node:test";
import assert from "node:assert/strict";

import { writeTextWithFallback as writeCardTextWithFallback } from "../app/prompts/[slug]/_copy-card-button.js";
import { writeTextWithFallback as writeActionTextWithFallback } from "../app/prompts/[slug]/_prompt-actions.js";

function createDocumentMock() {
  const state = {
    copiedText: "",
    removed: false,
  };

  const textarea = {
    value: "",
    setAttribute() {},
    style: {},
    focus() {},
    select() {},
    setSelectionRange() {},
    remove() {
      state.removed = true;
    },
  };

  return {
    state,
    document: {
      body: {
        appendChild(node) {
          state.copiedText = node.value;
        },
      },
      createElement() {
        return textarea;
      },
      execCommand(command) {
        return command === "copy";
      },
    },
  };
}

test("复制回退在缺少 clipboard 时仍可通过 execCommand 完成", async () => {
  const originalDocument = globalThis.document;
  const originalNavigator = globalThis.navigator;
  const { state, document } = createDocumentMock();

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: document,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: undefined,
  });

  try {
    await assert.doesNotReject(async () => {
      assert.equal(await writeCardTextWithFallback("card-copy"), true);
      assert.equal(await writeActionTextWithFallback("action-copy"), true);
    });
    assert.equal(state.copiedText, "action-copy");
    assert.equal(state.removed, true);
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: originalDocument,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
  }
});
