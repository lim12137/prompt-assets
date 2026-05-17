import { NextResponse } from "next/server.js";

import { deleteAdminPrompt } from "../../../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireManageUser,
} from "../../../../../../lib/auth/session.ts";

type RouteParams = {
  slug: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

type DeleteBody = {
  confirm?: unknown;
  confirmationToken?: unknown;
  reason?: unknown;
};

export async function DELETE(request: Request, context: RouteContext) {
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

  const body = (await request.json().catch(() => ({}))) as DeleteBody;
  const confirm = body.confirm === true;
  const confirmationToken =
    typeof body.confirmationToken === "string" ? body.confirmationToken.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (confirm && !confirmationToken) {
    return NextResponse.json(
      {
        error: "confirmation token is required",
        code: "prompt_delete_confirmation_required",
      },
      { status: 400 },
    );
  }

  const params = await Promise.resolve(context.params);
  const result = await deleteAdminPrompt({
    reviewerEmail: operator.uid,
    reviewerRole: "admin",
    slug: params.slug,
    confirm,
    confirmationToken: confirmationToken || undefined,
    reason: reason || undefined,
  });

  if (result.ok) {
    return NextResponse.json(result.value, { status: 200 });
  }

  const failedResult = result as {
    ok: false;
    code: "forbidden" | "not_found" | "bad_request";
    reason:
      | "admin_role_required"
      | "prompt_not_found"
      | "prompt_delete_confirmation_required"
      | "invalid_confirmation_token";
    message: string;
  };
  const status =
    failedResult.code === "forbidden"
      ? 403
      : failedResult.code === "not_found"
        ? 404
        : 400;
  return NextResponse.json(
    {
      error: failedResult.message,
      code: failedResult.reason,
    },
    { status },
  );
}
