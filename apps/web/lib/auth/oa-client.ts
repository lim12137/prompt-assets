type OaUserInfo = {
  id: string;
  name: string;
  department?: string;
};

type OaLoginSuccess = {
  ok: true;
  userInfo: OaUserInfo;
};

type OaLoginFailure = {
  ok: false;
  message: string;
};

type OaLoginResult = OaLoginSuccess | OaLoginFailure;

type OaLoginInput = {
  username: string;
  password?: string;
  passwordEncrypted?: string | number | boolean;
};

type OaClient = (input: OaLoginInput) => Promise<OaLoginResult>;

let oaClientForTests: OaClient | null = null;

export function __setOaClientForTests(client: OaClient | null): void {
  oaClientForTests = client;
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized ? normalized : null;
}

function pickFieldFromRecord(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = normalizeString(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function pickFieldByRegex(text: string, keys: string[]): string | null {
  for (const key of keys) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`["']${escapedKey}["']\\s*:\\s*["']([^"']+)["']`, "i"),
      new RegExp(`(?:^|\\n|\\r|>)\\s*${escapedKey}\\s*[：:]\\s*([^\\r\\n<]+)`, "i"),
    ];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      const value = normalizeString(match?.[1]);
      if (value) {
        return value;
      }
    }
  }
  return null;
}

async function callOaPortal(input: OaLoginInput): Promise<OaLoginResult> {
  const baseUrl = process.env.AWS_PORTAL_URL?.trim();
  if (!baseUrl) {
    return { ok: false, message: "AWS_PORTAL_URL is required" };
  }

  const loginResponse = await fetch(`${baseUrl}/portal/r/jd`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      username: input.username,
      password: input.password ?? "",
      ...(input.passwordEncrypted ? { password_encrypted: "1" } : {}),
    }),
  });
  if (!loginResponse.ok) {
    return { ok: false, message: "oa credential validation failed" };
  }
  const loginCookie = loginResponse.headers.get("set-cookie")?.split(";")[0]?.trim() ?? "";

  const profileResponse = await fetch(`${baseUrl}/portal/r/w`, {
    method: "POST",
    headers: loginCookie ? { cookie: loginCookie } : undefined,
  });
  if (!profileResponse.ok) {
    return { ok: false, message: "oa profile query failed" };
  }
  const profileText = await profileResponse.text();
  const userId = input.username.trim();
  let profileJson: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(profileText) as unknown;
    if (parsed && typeof parsed === "object") {
      profileJson = parsed as Record<string, unknown>;
    }
  } catch {
    profileJson = null;
  }
  const name =
    (profileJson ? pickFieldFromRecord(profileJson, ["name", "realName", "username", "姓名"]) : null) ??
    pickFieldByRegex(profileText, ["name", "realName", "username", "姓名"]) ??
    userId;
  const department =
    (profileJson
      ? pickFieldFromRecord(profileJson, ["department", "dept", "org", "部门", "组织", "organization"])
      : null) ??
    pickFieldByRegex(profileText, ["department", "dept", "org", "部门", "组织", "organization"]) ??
    undefined;
  return {
    ok: true,
    userInfo: {
      id: userId,
      name,
      ...(department ? { department } : {}),
    },
  };
}

export async function authenticateWithOa(input: OaLoginInput): Promise<OaLoginResult> {
  if (oaClientForTests) {
    return oaClientForTests(input);
  }
  return callOaPortal(input);
}
