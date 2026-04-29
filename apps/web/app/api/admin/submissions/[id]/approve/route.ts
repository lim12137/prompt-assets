import { NextResponse } from "next/server.js";

import { reviewPromptSubmission } from "../../../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  ForbiddenError,
  UnauthorizedError,
  requireManageUser,
} from "../../../../../../lib/auth/session.ts";

type RouteParams = {
  id: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

type ReviewBody = {
  reviewComment?: unknown;
};

function mapReviewErrorCode(
  code: "forbidden" | "not_found" | "conflict",
): "admin_role_required" | "submission_not_found" | "submission_not_pending" {
  if (code === "forbidden") {
    return "admin_role_required";
  }
  if (code === "not_found") {
    return "submission_not_found";
  }
  return "submission_not_pending";
}

async function parseReviewComment(request: Request): Promise<string | undefined> {
  if (!request.body) {
    return undefined;
  }

  const body = (await request.json().catch(() => ({}))) as ReviewBody;
  const comment =
    typeof body.reviewComment === "string" ? body.reviewComment.trim() : "";
  return comment.length > 0 ? comment : undefined;
}

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
    if (!(error instanceof UnauthorizedError || error instanceof ForbiddenError)) {
      throw error;
    }
    return NextResponse.json(
      {
        error: "admin role is required",
        code: "admin_role_required",
      },
      { status: 403 },
    );
  }

  const params = await Promise.resolve(context.params);
  const submissionId = Number(params.id);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return NextResponse.json({ error: "invalid submission id" }, { status: 400 });
  }

  const result = await reviewPromptSubmission(submissionId, "approve", {
    reviewerEmail: operator.uid,
    reviewerRole: "admin",
    reviewComment: await parseReviewComment(request),
  });

  if ("code" in result) {
    const status =
      result.code === "forbidden" ? 403 : result.code === "conflict" ? 409 : 404;
    return NextResponse.json(
      {
        error: result.message,
        code: mapReviewErrorCode(result.code),
      },
      { status },
    );
  }

  return NextResponse.json(result.value, { status: 200 });
}
