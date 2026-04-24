import { NextResponse } from "next/server.js";

import { deleteAdminCategory } from "../../../../../lib/api/prompt-repository.ts";

type DeleteCategoryBody = {
  confirm?: unknown;
  confirmationToken?: unknown;
};

type RouteParams = {
  slug: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

function resolveReviewerRole(request: Request): "admin" | "user" {
  return request.headers.get("x-user-role")?.trim().toLowerCase() === "admin"
    ? "admin"
    : "user";
}

function resolveReviewerEmail(request: Request): string {
  return request.headers.get("x-user-email")?.trim() ?? "";
}

export async function DELETE(
  request: Request,
  context: RouteContext,
) {
  if (resolveReviewerRole(request) !== "admin") {
    return NextResponse.json(
      {
        error: "admin role is required",
        code: "admin_role_required",
      },
      { status: 403 },
    );
  }

  let body: DeleteCategoryBody = {};
  try {
    body = (await request.json()) as DeleteCategoryBody;
  } catch {
    body = {};
  }

  const confirm = body.confirm === true;
  const confirmationToken =
    typeof body.confirmationToken === "string" ? body.confirmationToken.trim() : "";

  if (confirm && !confirmationToken) {
    return NextResponse.json(
      {
        error: "confirmation token is required",
        code: "category_delete_confirmation_required",
      },
      { status: 400 },
    );
  }

  const params = await Promise.resolve(context.params);

  const result = await deleteAdminCategory({
    reviewerEmail: resolveReviewerEmail(request),
    reviewerRole: "admin",
    slug: params.slug,
    confirm,
    confirmationToken: confirmationToken || undefined,
  });

  if (result.ok) {
    return NextResponse.json(result.value, { status: 200 });
  }

  const failedResult = result as {
    ok: false;
    code: "forbidden" | "not_found" | "bad_request" | "conflict";
    reason:
      | "admin_role_required"
      | "system_category_forbidden"
      | "category_not_found"
      | "category_delete_confirmation_required"
      | "invalid_confirmation_token"
      | "category_delete_conflict";
    message: string;
  };
  const status =
    failedResult.code === "forbidden"
      ? 403
      : failedResult.code === "not_found"
        ? 404
        : failedResult.code === "conflict"
          ? 409
          : 400;
  return NextResponse.json(
    {
      error: failedResult.message,
      code: failedResult.reason,
    },
    { status },
  );
}
