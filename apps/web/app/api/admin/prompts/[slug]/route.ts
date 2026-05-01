import { NextResponse } from "next/server.js";

import { updateAdminPromptCategories } from "../../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireManageUser,
} from "../../../../../lib/auth/session.ts";

type RouteParams = {
  slug: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

type PatchBody = {
  categorySlugs?: unknown;
  primaryCategorySlug?: unknown;
};

export async function PATCH(request: Request, context: RouteContext) {
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
  const categorySlugs = Array.isArray(body.categorySlugs)
    ? body.categorySlugs
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    : [];
  const primaryCategorySlug =
    typeof body.primaryCategorySlug === "string"
      ? body.primaryCategorySlug.trim()
      : "";

  const params = await Promise.resolve(context.params);
  const result = await updateAdminPromptCategories({
    reviewerEmail: operator.uid,
    reviewerRole: "admin",
    slug: params.slug,
    categorySlugs,
    primaryCategorySlug,
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
