import { NextResponse } from "next/server.js";

import { reviewPromptSubmission } from "../../../../../../lib/api/prompt-repository.ts";

type RouteParams = {
  id: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

type ReviewBody = {
  reviewComment?: unknown;
};

function resolveReviewerEmail(request: Request): string {
  return request.headers.get("x-user-email")?.trim() ?? "";
}

function resolveReviewerRole(request: Request): "user" | "admin" {
  return request.headers.get("x-user-role")?.trim().toLowerCase() === "admin"
    ? "admin"
    : "user";
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
  const params = await Promise.resolve(context.params);
  const submissionId = Number(params.id);
  if (!Number.isInteger(submissionId) || submissionId <= 0) {
    return NextResponse.json({ error: "invalid submission id" }, { status: 400 });
  }

  const result = await reviewPromptSubmission(submissionId, "reject", {
    reviewerEmail: resolveReviewerEmail(request),
    reviewerRole: resolveReviewerRole(request),
    reviewComment: await parseReviewComment(request),
  });

  if (!result.ok) {
    const status =
      result.code === "forbidden" ? 403 : result.code === "conflict" ? 409 : 404;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json(result.value, { status: 200 });
}
