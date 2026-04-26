import { NextResponse } from "next/server.js";

import {
  likePromptVersion,
  unlikePromptVersion,
} from "../../../../../../../lib/api/prompt-repository.ts";

type RouteParams = {
  slug: string;
  versionNo: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
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
  const params = await context.params;
  const slug = decodeURIComponent(params.slug ?? "").trim();
  const versionNo = decodeURIComponent(params.versionNo ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (!versionNo) {
    return NextResponse.json({ error: "invalid versionNo" }, { status: 400 });
  }

  const userEmail = resolveUserEmail(request);
  if (!isValidEmail(userEmail)) {
    return NextResponse.json({ error: "invalid user email" }, { status: 400 });
  }

  const result = await likePromptVersion(slug, versionNo, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const params = await context.params;
  const slug = decodeURIComponent(params.slug ?? "").trim();
  const versionNo = decodeURIComponent(params.versionNo ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }
  if (!versionNo) {
    return NextResponse.json({ error: "invalid versionNo" }, { status: 400 });
  }

  const userEmail = resolveUserEmail(request);
  if (!isValidEmail(userEmail)) {
    return NextResponse.json({ error: "invalid user email" }, { status: 400 });
  }

  const result = await unlikePromptVersion(slug, versionNo, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
