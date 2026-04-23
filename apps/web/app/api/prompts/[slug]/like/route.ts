import { NextResponse } from "next/server.js";

import {
  likePrompt,
  unlikePrompt,
} from "../../../../../lib/api/prompt-repository.ts";

type RouteParams = {
  slug: string;
};

type RouteContext = {
  params: RouteParams | Promise<RouteParams>;
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

  const result = await likePrompt(slug, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
  const params = await Promise.resolve(context.params);
  const slug = decodeURIComponent(params.slug ?? "").trim();

  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  const userEmail = resolveUserEmail(request);
  if (!isValidEmail(userEmail)) {
    return NextResponse.json({ error: "invalid user email" }, { status: 400 });
  }

  const result = await unlikePrompt(slug, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
