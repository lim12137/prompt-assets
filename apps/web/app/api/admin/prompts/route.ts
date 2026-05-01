import { NextResponse } from "next/server.js";

import { listAdminPrompts } from "../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireManageUser,
} from "../../../../lib/auth/session.ts";

function normalizeStatus(rawStatus: string | null) {
  if (!rawStatus) {
    return undefined;
  }
  const value = rawStatus.trim().toLowerCase();
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    requireManageUser(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "auth_configuration_error" },
        { status: 500 },
      );
    }
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      return NextResponse.json(
        { error: "admin role is required", code: "admin_role_required" },
        { status: 403 },
      );
    }
    throw error;
  }

  const { searchParams } = new URL(request.url);
  const status = normalizeStatus(searchParams.get("status"));
  if (status === null) {
    return NextResponse.json(
      { error: "invalid prompt status", code: "invalid_prompt_status" },
      { status: 400 },
    );
  }

  const prompts = await listAdminPrompts({
    status,
    category: searchParams.get("category") ?? undefined,
    keyword: searchParams.get("keyword") ?? undefined,
  });
  return NextResponse.json({ prompts }, { status: 200 });
}
