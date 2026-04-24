import { NextResponse } from "next/server.js";

import {
  listAdminSubmissions,
  type PromptSubmissionReviewInput,
} from "../../../../lib/api/prompt-repository.ts";

type SubmissionStatus = "pending" | "approved" | "rejected";

function resolveReviewerRole(request: Request): PromptSubmissionReviewInput["reviewerRole"] {
  return request.headers.get("x-user-role")?.trim().toLowerCase() === "admin"
    ? "admin"
    : "user";
}

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
  if (resolveReviewerRole(request) !== "admin") {
    return NextResponse.json(
      {
        error: "admin role is required",
        code: "admin_role_required",
      },
      { status: 403 },
    );
  }

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
}
