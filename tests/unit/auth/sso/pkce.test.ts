import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  generatePkcePair,
  createCodeChallenge,
  PKCE_CODE_CHALLENGE_METHOD,
} from "../../../../apps/web/lib/auth/sso/pkce.ts";

test("generatePkcePair: code_verifier 长度在 43~128 字符之间（RFC 7636）", () => {
  const { codeVerifier } = generatePkcePair();
  assert.ok(
    codeVerifier.length >= 43 && codeVerifier.length <= 128,
    `verifier 长度 ${codeVerifier.length} 不在 [43,128]`,
  );
});

test("generatePkcePair: code_verifier 字符集为 base64url（A-Za-z0-9-_）", () => {
  const { codeVerifier } = generatePkcePair();
  assert.match(codeVerifier, /^[A-Za-z0-9_-]+$/);
});

test("generatePkcePair: 每次生成的 verifier 不同（不可复用）", () => {
  const set = new Set<string>();
  for (let i = 0; i < 100; i++) {
    set.add(generatePkcePair().codeVerifier);
  }
  assert.equal(set.size, 100, "100 次生成应得到 100 个不同 verifier");
});

test("generatePkcePair: code_challenge_method 必须是 S256，不能用 plain", () => {
  const { codeChallengeMethod } = generatePkcePair();
  assert.equal(codeChallengeMethod, "S256");
  assert.equal(PKCE_CODE_CHALLENGE_METHOD, "S256");
});

test("generatePkcePair: code_challenge = base64url(SHA256(code_verifier))", () => {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const expected = createHash("sha256").update(codeVerifier, "utf8").digest("base64url");
  assert.equal(codeChallenge, expected);
});

test("createCodeChallenge: 已知 verifier 计算出确定性 challenge", () => {
  // 已知向量：verifier "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
  // 来自 RFC 7636 §A.3 / §B（S256 示例）
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
  assert.equal(createCodeChallenge(verifier), expectedChallenge);
});

test("createCodeChallenge: 相同 verifier 产出相同 challenge（可重现）", () => {
  const verifier = "any-fixed-verifier-for-test-1234567890";
  const a = createCodeChallenge(verifier);
  const b = createCodeChallenge(verifier);
  assert.equal(a, b);
});

test("createCodeChallenge: 不同 verifier 产出不同 challenge", () => {
  const a = createCodeChallenge("verifier-A-xxxxx");
  const b = createCodeChallenge("verifier-B-yyyyy");
  assert.notEqual(a, b);
});
