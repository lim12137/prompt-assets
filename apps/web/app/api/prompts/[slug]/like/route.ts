import { NextResponse } from "next/server.js";

import {
  likePrompt,
  unlikePrompt,
} from "../../../../../lib/api/prompt-repository.ts";
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

  const result = await likePrompt(slug, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}

export async function DELETE(request: Request, context: RouteContext) {
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

  const result = await unlikePrompt(slug, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
