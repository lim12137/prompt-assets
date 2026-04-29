import { NextResponse } from "next/server.js";

import {
  AuthConfigurationError,
  getUserFromRequest,
} from "../../../lib/auth/session.ts";

export async function GET(request: Request) {
  let user;
  try {
    user = getUserFromRequest(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "auth_configuration_error" },
        { status: 500 },
      );
    }
    throw error;
  }
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }
  return NextResponse.json({ user }, { status: 200 });
}
