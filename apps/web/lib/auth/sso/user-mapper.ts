/**
 * SSO userInfo → 本系统用户身份映射。
 *
 * 解决 spec §8 的核心缺口：
 * - DB users 表需要 email，但 SSO 只返回工号（userAccount），无 email。
 * - 用 `${userAccount}@internal.local` 作占位 email 写入 DB。
 *
 * SSO userInfo JSON 层级每个平台不同（playbook 12.4-1、坑 13.3），
 * 这里做多字段 fallback：优先 `data.user.userAccount`，再尝试常见变体。
 */

export type MappedSsoUser = {
  /** 工号 / 账号（本系统 uid） */
  uid: string;
  /** 显示名 */
  name: string;
  /** 部门（可选） */
  department?: string;
  /** 占位 email，供 DB users.email 用 */
  email: string;
};

/**
 * userInfo 缺失 userAccount（无法识别身份）时抛出。
 * callback 据此返回 failure(missing_user_account)。
 */
export class MissingUserAccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingUserAccountError";
  }
}

const INTERNAL_EMAIL_DOMAIN = "internal.local";

function pickString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

/**
 * 从嵌套 record 里按点分路径取子 record。
 * 例如 getByPath({ data: { user: {...} } }, ["data","user"]) → user record
 */
function getByPath(record: Record<string, unknown>, path: string[]): Record<string, unknown> | null {
  let current: unknown = record;
  for (const segment of path) {
    if (current && typeof current === "object" && current !== null) {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return null;
    }
  }
  if (current && typeof current === "object" && current !== null) {
    return current as Record<string, unknown>;
  }
  return null;
}

/**
 * 在 userInfo 里查找"用户记录"子对象。
 * 常见层级：data.user / data / user / 根。逐个尝试。
 */
function findUserRecord(userInfo: Record<string, unknown>): Record<string, unknown> | null {
  const candidates: Array<Record<string, unknown> | null> = [
    getByPath(userInfo, ["data", "user"]),
    getByPath(userInfo, ["data"]),
    getByPath(userInfo, ["user"]),
    userInfo,
  ];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate;
    }
  }
  return userInfo;
}

/**
 * 把 SSO userInfo（profileUrl 返回的 JSON）映射成本系统用户身份。
 *
 * @throws MissingUserAccountError 当无法识别 userAccount 时
 */
export function mapSsoUserToSystemUser(userInfo: unknown): MappedSsoUser {
  if (!userInfo || typeof userInfo !== "object") {
    throw new MissingUserAccountError("sso userInfo is empty or not an object");
  }
  const root = userInfo as Record<string, unknown>;
  const userRecord = findUserRecord(root);

  const uid =
    pickString(userRecord, ["userAccount", "account", "employeeId", "loginName", "uid", "username"]) ??
    null;
  if (!uid) {
    throw new MissingUserAccountError(
      "sso userInfo missing userAccount (tried userAccount/account/employeeId/loginName/uid/username)",
    );
  }

  const name =
    pickString(userRecord, ["userName", "name", "realName", "nickName", "displayName", "姓名"]) ??
    uid;

  const department =
    pickString(userRecord, ["deptName", "department", "dept", "org", "organization", "部门"]) ??
    undefined;

  const email = buildPlaceholderEmail(uid);

  return {
    uid,
    name,
    ...(department ? { department } : {}),
    email,
  };
}

/**
 * 用工号拼占位 email：`${uid}@internal.local`。
 * 单独导出便于测试和 DB upsert 复用。
 */
export function buildPlaceholderEmail(uid: string): string {
  const normalized = uid.trim().toLowerCase();
  return `${normalized}@${INTERNAL_EMAIL_DOMAIN}`;
}
