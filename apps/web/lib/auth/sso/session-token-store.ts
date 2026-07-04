/**
 * SSO session token 存储。
 *
 * 用途（spec §5.2）：callback 成功后，把 SSO 返回的 access_token/refresh_token
 * 存起来，供 logout-all 代发 Bearer 调用 SSO logout 端点。
 *
 * 硬规则：
 * - 这些 token 只在后端内存，绝不返回前端或写日志（client_secret/access_token 都是敏感）。
 * - key 是本系统生成的 sessionId（写进 sso_session_id cookie）。
 * - 内存实现，单实例够用；多实例换 Redis（保留 SessionTokenStore 接口）。
 * - TTL 略长于本系统 token TTL，避免用户登录态还在但 SSO token 已清导致 logout 失败。
 */

export type SsoSessionTokens = {
  accessToken: string;
  refreshToken?: string;
};

export interface SessionTokenStore {
  save(sessionId: string, tokens: SsoSessionTokens, ttlMs?: number): void;
  get(sessionId: string): SsoSessionTokens | null;
  delete(sessionId: string): void;
}

const DEFAULT_TTL_MS = 7_200_000; // 2 小时，略长于本系统 token TTL（120min）

type Entry = SsoSessionTokens & { expiresAt: number };

export function createMemorySessionTokenStore(): SessionTokenStore {
  const store = new Map<string, Entry>();
  return {
    save(sessionId, tokens, ttlMs) {
      const now = Date.now();
      pruneExpired(store, now);
      store.set(sessionId, { ...tokens, expiresAt: now + (ttlMs ?? DEFAULT_TTL_MS) });
    },
    get(sessionId) {
      const entry = store.get(sessionId);
      if (!entry) {
        return null;
      }
      if (Date.now() >= entry.expiresAt) {
        store.delete(sessionId);
        return null;
      }
      return { accessToken: entry.accessToken, ...(entry.refreshToken ? { refreshToken: entry.refreshToken } : {}) };
    },
    delete(sessionId) {
      store.delete(sessionId);
    },
  };
}

let defaultStore: SessionTokenStore = createMemorySessionTokenStore();

export function getDefaultSessionTokenStore(): SessionTokenStore {
  return defaultStore;
}

export function __setDefaultSessionTokenStoreForTests(store: SessionTokenStore | null): void {
  defaultStore = store ?? createMemorySessionTokenStore();
}

export function __resetDefaultSessionTokenStoreForTests(): void {
  __setDefaultSessionTokenStoreForTests(null);
}

export function saveSsoTokensForSession(sessionId: string, tokens: SsoSessionTokens, ttlMs?: number): void {
  getDefaultSessionTokenStore().save(sessionId, tokens, ttlMs);
}

export function getSsoTokensForSession(sessionId: string): SsoSessionTokens | null {
  return getDefaultSessionTokenStore().get(sessionId);
}

export function deleteSsoTokensForSession(sessionId: string): void {
  getDefaultSessionTokenStore().delete(sessionId);
}

function pruneExpired(store: Map<string, Entry>, now: number): void {
  for (const [key, entry] of store) {
    if (now >= entry.expiresAt) {
      store.delete(key);
    }
  }
}
