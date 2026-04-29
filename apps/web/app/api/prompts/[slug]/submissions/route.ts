import { NextResponse } from "next/server.js";

import { createPromptSubmission } from "../../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  getUserFromRequest,
} from "../../../../../lib/auth/session.ts";

type RouteParams = {
  slug: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

type SubmissionBody = {
  content?: unknown;
  changeNote?: unknown;
};

export async function POST(request: Request, context: RouteContext) {
  const params = await context.params;
  const slug = decodeURIComponent(params.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  let user;
  try {
    user = getUserFromRequest(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return NextResponse.json(
        { error: error.message, code: "auth_configuration_error" },
        { status: 500 },
      );
    }
    throw error;
  }
  if (!user) {
    return NextResponse.json(
      { error: "unauthorized", code: "unauthorized" },
      { status: 401 },
    );
  }
  const userEmail = user.uid;

  let body: SubmissionBody;
  try {
    body = (await request.json()) as SubmissionBody;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const rawChangeNote =
    typeof body.changeNote === "string" ? body.changeNote.trim() : "";
  const changeNote = rawChangeNote.length > 0 ? rawChangeNote : undefined;

  const result = await createPromptSubmission(slug, {
    userEmail,
    content,
    changeNote,
  });
  if (!result) {
    return NextResponse.json({ error: "prompt not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 201 });
}
