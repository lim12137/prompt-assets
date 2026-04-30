import { NextResponse } from "next/server.js";

import { authenticateWithOa } from "../../../lib/auth/oa-client.ts";
import {
  AuthConfigurationError,
  buildLoginCookie,
  parseWhitelistSettingsFromEnv,
  resolveManageFlags,
  signLoginToken,
} from "../../../lib/auth/session.ts";

type LoginBody = {
  username?: unknown;
  password?: unknown;
  password_encrypted?: unknown;
  redirect?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordEncrypted = body.password_encrypted;
  const redirect = typeof body.redirect === "string" ? body.redirect.trim() : "";

  if (!username || !password) {
    return NextResponse.json(
      { error: "username/password are required", code: "invalid_request" },
      { status: 400 },
    );
  }

  const oaResult = await authenticateWithOa({
    username,
    password,
    passwordEncrypted,
  });
  if (!oaResult.ok) {
    return NextResponse.json(
      { error: oaResult.message, code: "invalid_credentials" },
      { status: 401 },
    );
  }

  const settings = parseWhitelistSettingsFromEnv();
  const flags = resolveManageFlags(
    { uid: oaResult.userInfo.id, name: oaResult.userInfo.name },
    settings,
  );
  let token: string;
  try {
    token = signLoginToken({
      uid: oaResult.userInfo.id,
      name: oaResult.userInfo.name,
      department: oaResult.userInfo.department,
      can_manage: flags.can_manage,
      can_manage_whitelist: flags.can_manage_whitelist,
    });
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "auth_configuration_error" },
        { status: 500 },
      );
    }
    throw error;
  }

  const response = NextResponse.json(
    {
      user: {
        uid: oaResult.userInfo.id,
        name: oaResult.userInfo.name,
        department: oaResult.userInfo.department,
        can_manage: flags.can_manage,
        can_manage_whitelist: flags.can_manage_whitelist,
      },
      redirect: redirect || "/admin",
    },
    { status: 200 },
  );
  response.headers.append("set-cookie", buildLoginCookie(token));
  return response;
}
