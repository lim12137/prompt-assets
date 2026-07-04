import { createHash, randomBytes } from "node:crypto";

/**
 * PKCE (Proof Key for Code Exchange) helpers for OAuth/OIDC Authorization Code + PKCE.
 *
 * 规范：RFC 7636，code_challenge_method = S256。
 *
 * - code_verifier：43~128 字符的随机字符串，字符集 [A-Z][a-z][0-9]-._~（unreserved）。
 * - code_challenge：base64url(SHA256(code_verifier))，去填充。
 *
 * 安全要点：
 * - code_verifier 必须每个登录请求重新生成，不可复用。
 * - S256 是唯一允许的 method，不要用 plain。
 * - code_verifier 只在后端生成与保存（state-store），前端不接触。
 */

const VERIFIER_BYTE_LENGTH = 48; // 48 字节 → base64url 约 64 字符，落在 43~128 区间内
const CHALLENGE_METHOD = "S256" as const;

/**
 * 生成一对 code_verifier / code_challenge。
 * 返回的 code_verifier 需要在 start 时存入 state-store，在 callback 时取出发给 token 端点。
 */
export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
} {
  const codeVerifier = randomBytes(VERIFIER_BYTE_LENGTH).toString("base64url");
  const codeChallenge = createCodeChallenge(codeVerifier);
  return { codeVerifier, codeChallenge, codeChallengeMethod: CHALLENGE_METHOD };
}

/**
 * 由 code_verifier 计算 code_challenge（S256）。
 * 单独导出便于测试：用已知的 verifier 验证 challenge 计算正确。
 */
export function createCodeChallenge(codeVerifier: string): string {
  return createHash("sha256").update(codeVerifier, "utf8").digest("base64url");
}

export const PKCE_CODE_CHALLENGE_METHOD = CHALLENGE_METHOD;
