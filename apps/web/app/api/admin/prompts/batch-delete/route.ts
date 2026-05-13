import { NextResponse } from "next/server.js";

import { deleteAdminPromptsBatch } from "../../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireManageUser,
} from "../../../../../lib/auth/session.ts";

type DeleteBody = {
  slugs?: unknown;
  dryRun?: unknown;
  confirm?: unknown;
  confirmationToken?: unknown;
  reason?: unknown;
};

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export async function DELETE(request: Request) {
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
  const dryRun = body.dryRun === true;
  const confirm = body.confirm === true;
  const confirmationToken =
    typeof body.confirmationToken === "string" ? body.confirmationToken.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (dryRun === confirm) {
    return NextResponse.json(
      {
        error: "exactly one of dryRun=true or confirm=true is required",
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  if (confirm && !confirmationToken) {
    return NextResponse.json(
      {
        error: "confirmation token is required",
        code: "prompt_delete_confirmation_required",
      },
      { status: 400 },
    );
  }

  const result = await deleteAdminPromptsBatch({
    reviewerEmail: operator.uid,
    reviewerRole: "admin",
    slugs: normalizeStringArray(body.slugs),
    dryRun,
    confirm,
    confirmationToken: confirmationToken || undefined,
    reason: reason || undefined,
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
