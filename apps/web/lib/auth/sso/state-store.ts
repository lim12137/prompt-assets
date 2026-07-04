import { randomUUID } from "node:crypto";

/**
 * SSO OAuth/OIDC 状态存储。
 *
 * 存放 start 阶段生成的 state/nonce/codeVerifier，在 callback 阶段取出使用。
 *
 * 硬规则（playbook 第三章、坑 9）：
 * - state 必须一次性消费：取出即删，防止重放。
 * - TTL 默认 300s，过期条目在存/取时惰性清理。
 * - 内存 Map 实现，单实例够用；多实例部署需替换为 Redis（实现 SsoStateStore 接口即可）。
 */

export type StoredSsoState = {
  /** OAuth state 参数，也作为存储 key */
  state: string;
  /** OIDC nonce，写进 id_token 待比对 */
  nonce: string;
  /** PKCE code_verifier，换 token 时用 */
  codeVerifier: string;
  /** 登录成功后回跳的站内路径（已 sanitize） */
  returnTo: string;
  /** 过期时间戳（ms） */
  expiresAt: number;
};

export type ConsumeResult =
  | { ok: true; state: StoredSsoState }
  | { ok: false; code: "not_found" | "expired" };

/** 默认 TTL 5 分钟（与 spec 一致），可被 save({ ttlMs }) 覆盖 */
const DEFAULT_TTL_MS = 300_000;

/**
 * 抽象接口：未来换 Redis 时实现这个即可，调用方不变。
 */
export interface SsoStateStore {
  save(input: {
    nonce: string;
    codeVerifier: string;
    returnTo: string;
    state?: string;
    ttlMs?: number;
  }): string;
  consume(state: string): ConsumeResult;
}

type Entry = StoredSsoState;

/**
 * 创建一个独立的内存 store 实例。
 * 测试用这个避免相互污染；生产用 getDefaultStateStore() 拿单例。
 */
export function createMemoryStateStore(): SsoStateStore {
  const store = new Map<string, Entry>();
  return {
    save(input) {
      const now = Date.now();
      const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
      const state = input.state ?? randomUUID();
      const entry: Entry = {
        state,
        nonce: input.nonce,
        codeVerifier: input.codeVerifier,
        returnTo: input.returnTo,
        expiresAt: now + ttlMs,
      };
      pruneExpired(store, now);
      store.set(state, entry);
      return state;
    },
    consume(state) {
      if (!state) {
        return { ok: false, code: "not_found" };
      }
      // 取出即删（一次性消费，防重放）
      const entry = store.get(state);
      store.delete(state);
      if (!entry) {
        return { ok: false, code: "not_found" };
      }
      if (Date.now() >= entry.expiresAt) {
        return { ok: false, code: "expired" };
      }
      return { ok: true, state: entry };
    },
  };
}

// 单例：路由代码通过 getDefaultStateStore() 访问，便于测试替换。
let defaultStore: SsoStateStore = createMemoryStateStore();

/**
 * 获取默认 store（路由代码用这个）。
 */
export function getDefaultStateStore(): SsoStateStore {
  return defaultStore;
}

/**
 * 测试专用：把默认 store 替换为给定实例；传 null 恢复成新的空 store。
 * 生产代码不要调用。
 */
export function __setDefaultStateStoreForTests(store: SsoStateStore | null): void {
  defaultStore = store ?? createMemoryStateStore();
}

/**
 * 测试专用：清空默认 store（等价于替换为新的空实例）。
 */
export function __resetDefaultStateStoreForTests(): void {
  __setDefaultStateStoreForTests(null);
}

function pruneExpired(store: Map<string, Entry>, now: number): void {
  for (const [key, entry] of store) {
    if (now >= entry.expiresAt) {
      store.delete(key);
    }
  }
}
