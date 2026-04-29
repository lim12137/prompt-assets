import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export type LoginTokenUser = {
  uid: string;
  name: string;
  can_manage: boolean;
  can_manage_whitelist: boolean;
  exp: number;
  nonce: string;
};

type LoginTokenUserInput = Omit<LoginTokenUser, "exp" | "nonce">;

type VerifyResult =
  | { ok: true; user: LoginTokenUser }
  | { ok: false; code: "missing_token" | "invalid_token" | "expired_token" };

type WhitelistSettings = {
  enabled: boolean;
  defaultIds: Set<string>;
  defaultNames: Set<string>;
  adminIds: Set<string>;
  adminNames: Set<string>;
};

type ResolveUserInput = {
  uid: string;
  name: string;
};

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

function normalizeSet(raw: string | undefined): Set<string> {
  if (!raw) {
    return new Set();
  }
  return new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function requireSecret(secret: string | undefined): string {
  const normalized = secret?.trim() ?? "";
  if (!normalized) {
    throw new AuthConfigurationError("LOGIN_TOKEN_SECRET is required");
  }
  return normalized;
}

function getTtlMinutes(raw?: string): number {
  const value = Number(raw ?? "120");
  if (!Number.isFinite(value) || value <= 0) {
    return 120;
  }
  return Math.floor(value);
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(content: string, secret: string): string {
  return createHmac("sha256", secret).update(content).digest("base64url");
}

export function getLoginCookieName(): string {
  return process.env.LOGIN_COOKIE_NAME?.trim() || "auth_token";
}

export function parseWhitelistSettingsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): WhitelistSettings {
  return {
    enabled: (env.WHITELIST_ENABLED ?? "false").trim().toLowerCase() === "true",
    defaultIds: normalizeSet(env.WHITELIST_DEFAULT_IDS),
    defaultNames: normalizeSet(env.WHITELIST_DEFAULT_NAMES),
    adminIds: normalizeSet(env.WHITELIST_ADMIN_USER_IDS),
    adminNames: normalizeSet(env.WHITELIST_ADMIN_USER_NAMES),
  };
}

export function resolveManageFlags(user: ResolveUserInput, settings: WhitelistSettings): {
  can_manage: boolean;
  can_manage_whitelist: boolean;
} {
  if (!settings.enabled) {
    const allowAll =
      (process.env.ALLOW_ALL_LOGIN_USERS_MANAGE ?? "false").trim().toLowerCase() === "true";
    return {
      can_manage: allowAll,
      can_manage_whitelist: false,
    };
  }
  const canManage =
    settings.defaultIds.has(user.uid) || settings.defaultNames.has(user.name);
  const canManageWhitelist =
    settings.adminIds.has(user.uid) || settings.adminNames.has(user.name);
  return {
    can_manage: canManage,
    can_manage_whitelist: canManageWhitelist,
  };
}

export function signLoginToken(
  payload: LoginTokenUserInput,
  options?: {
    secret?: string;
    ttlMinutes?: number;
    now?: Date;
    nonce?: string;
  },
): string {
  const secret = requireSecret(options?.secret ?? process.env.LOGIN_TOKEN_SECRET);
  const nowMs = (options?.now ?? new Date()).getTime();
  const ttlMinutes = options?.ttlMinutes ?? getTtlMinutes(process.env.LOGIN_TOKEN_TTL_MINUTES);
  const exp = Math.floor(nowMs / 1000) + ttlMinutes * 60;
  const nonce = options?.nonce ?? randomUUID();
  const tokenPayload: LoginTokenUser = {
    ...payload,
    exp,
    nonce,
  };
  const body = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

export function verifyLoginToken(
  token: string | undefined | null,
  options?: { secret?: string; now?: Date },
): VerifyResult {
  if (!token) {
    return { ok: false, code: "missing_token" };
  }
  const secret = requireSecret(options?.secret ?? process.env.LOGIN_TOKEN_SECRET);
  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return { ok: false, code: "invalid_token" };
  }
  const expected = sign(body, secret);
  const signatureBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (
    signatureBuf.length !== expectedBuf.length ||
    !timingSafeEqual(signatureBuf, expectedBuf)
  ) {
    return { ok: false, code: "invalid_token" };
  }

  let parsed: LoginTokenUser;
  try {
    parsed = JSON.parse(base64UrlDecode(body)) as LoginTokenUser;
  } catch {
    return { ok: false, code: "invalid_token" };
  }

  if (
    !parsed ||
    typeof parsed.uid !== "string" ||
    typeof parsed.name !== "string" ||
    typeof parsed.can_manage !== "boolean" ||
    typeof parsed.can_manage_whitelist !== "boolean" ||
    typeof parsed.exp !== "number" ||
    typeof parsed.nonce !== "string"
  ) {
    return { ok: false, code: "invalid_token" };
  }

  const nowSec = Math.floor((options?.now ?? new Date()).getTime() / 1000);
  if (parsed.exp <= nowSec) {
    return { ok: false, code: "expired_token" };
  }
  return { ok: true, user: parsed };
}

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) {
    return map;
  }
  for (const pair of cookieHeader.split(";")) {
    const index = pair.indexOf("=");
    if (index <= 0) {
      continue;
    }
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!key) {
      continue;
    }
    map[key] = decodeURIComponent(value);
  }
  return map;
}

export function getUserFromRequest(request: Request): LoginTokenUser | null {
  const cookies = parseCookieHeader(request.headers.get("cookie"));
  const token = cookies[getLoginCookieName()];
  const verified = verifyLoginToken(token);
  return verified.ok ? verified.user : null;
}

export function requireManageUser(request: Request): LoginTokenUser {
  const user = getUserFromRequest(request);
  if (!user) {
    throw new UnauthorizedError("login is required");
  }
  if (!user.can_manage) {
    throw new ForbiddenError("admin role is required");
  }
  return user;
}

export function buildLoginCookie(token: string): string {
  const secureEnv = (process.env.LOGIN_COOKIE_SECURE ?? "").trim().toLowerCase();
  const secure =
    secureEnv === "true" || (secureEnv !== "false" && process.env.NODE_ENV === "production");
  const maxAge = getTtlMinutes(process.env.LOGIN_TOKEN_TTL_MINUTES) * 60;
  return [
    `${getLoginCookieName()}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function buildClearLoginCookie(): string {
  const secureEnv = (process.env.LOGIN_COOKIE_SECURE ?? "").trim().toLowerCase();
  const secure =
    secureEnv === "true" || (secureEnv !== "false" && process.env.NODE_ENV === "production");
  return [
    `${getLoginCookieName()}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}
