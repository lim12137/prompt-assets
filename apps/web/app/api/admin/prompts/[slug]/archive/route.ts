import { NextResponse } from "next/server.js";

import { archiveAdminPrompt } from "../../../../../../lib/api/prompt-repository.ts";
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

export async function POST(request: Request, context: RouteContext) {
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

  const params = await Promise.resolve(context.params);
  const result = await archiveAdminPrompt({
    reviewerEmail: operator.uid,
    reviewerRole: "admin",
    slug: params.slug,
  });

  if (result.ok) {
    return NextResponse.json(result.value, { status: 200 });
  }

  const failedResult = result as {
    ok: false;
    code: "forbidden" | "not_found" | "conflict";
    reason:
      | "admin_role_required"
      | "prompt_not_found"
      | "prompt_status_transition_not_allowed";
    message: string;
  };
  const status =
    failedResult.code === "forbidden"
      ? 403
      : failedResult.code === "not_found"
        ? 404
        : 409;
  return NextResponse.json(
    {
      error: failedResult.message,
      code: failedResult.reason,
    },
    { status },
  );
}
