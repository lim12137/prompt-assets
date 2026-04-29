import { NextResponse } from "next/server.js";

import {
  listAdminSubmissions,
} from "../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireManageUser,
} from "../../../../lib/auth/session.ts";

type SubmissionStatus = "pending" | "approved" | "rejected";

function normalizeStatus(rawStatus: string | null): SubmissionStatus | null {
  if (!rawStatus) {
    return "pending";
  }
  const value = rawStatus.trim().toLowerCase();
  if (value === "pending" || value === "approved" || value === "rejected") {
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
        {
          error: "admin role is required",
          code: "admin_role_required",
        },
        { status: 403 },
      );
    }
    throw error;
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = normalizeStatus(searchParams.get("status"));
    if (!status) {
      return NextResponse.json(
        {
          error: "invalid submission status",
          code: "invalid_submission_status",
        },
        { status: 400 },
      );
    }

    const submissions = await listAdminSubmissions({ status });
    return NextResponse.json({ submissions }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "internal error" },
      { status: 500 },
    );
  }
}
