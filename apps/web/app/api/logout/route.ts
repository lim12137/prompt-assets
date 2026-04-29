import { NextResponse } from "next/server.js";

import { buildClearLoginCookie } from "../../../lib/auth/session.ts";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.headers.append("set-cookie", buildClearLoginCookie());
  return response;
}
