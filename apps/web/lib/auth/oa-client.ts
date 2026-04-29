type OaUserInfo = {
  id: string;
  name: string;
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
  const nameMatch = profileText.match(/name["'\s:=>]+([^\s<]+)/i);
  return {
    ok: true,
    userInfo: {
      id: userId,
      name: nameMatch?.[1] ?? userId,
    },
  };
}

export async function authenticateWithOa(input: OaLoginInput): Promise<OaLoginResult> {
  if (oaClientForTests) {
    return oaClientForTests(input);
  }
  return callOaPortal(input);
}
