import { NextResponse } from "next/server.js";

import { updateAdminPromptsBatchCategories } from "../../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireManageUser,
} from "../../../../../lib/auth/session.ts";

type PatchBody = {
  slugs?: unknown;
  addCategorySlugs?: unknown;
  removeCategorySlugs?: unknown;
};

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function PATCH(request: Request) {
  let operator: { uid: string };
  try {
    operator = requireManageUser(request);
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

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const result = await updateAdminPromptsBatchCategories({
    reviewerEmail: operator.uid,
    reviewerRole: "admin",
    slugs: normalizeStringArray(body.slugs),
    addCategorySlugs: normalizeStringArray(body.addCategorySlugs),
    removeCategorySlugs: normalizeStringArray(body.removeCategorySlugs),
  });

  if (result.ok) {
    return NextResponse.json(result.value, { status: 200 });
  }

  const status = result.code === "forbidden" ? 403 : result.code === "not_found" ? 404 : 400;
  return NextResponse.json(
    {
      error: result.message,
      code: result.reason,
    },
    { status },
  );
}
