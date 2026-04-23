import { NextResponse } from "next/server.js";

import { createPromptSubmission } from "../../../../../lib/api/prompt-repository.ts";

type RouteParams = {
  slug: string;
};

type RouteContext = {
  params: RouteParams | Promise<RouteParams>;
};

type SubmissionBody = {
  content?: unknown;
  changeNote?: unknown;
};

const DEFAULT_USER_EMAIL = "alice@example.com";

function resolveUserEmail(request: Request): string {
  const fromHeader = request.headers.get("x-user-email")?.trim();
  if (fromHeader) {
    return fromHeader;
  }
  return DEFAULT_USER_EMAIL;
}

function isValidEmail(value: string): boolean {
  return value.includes("@");
}

export async function POST(request: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const slug = decodeURIComponent(params.slug ?? "").trim();
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const userEmail = resolveUserEmail(request);
  if (!isValidEmail(userEmail)) {
    return NextResponse.json({ error: "invalid user email" }, { status: 400 });
  }

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
