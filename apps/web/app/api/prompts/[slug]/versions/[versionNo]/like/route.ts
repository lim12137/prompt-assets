import { NextResponse } from "next/server.js";

import {
  likePromptVersion,
  markPromptVersionDailyInteraction,
  unlikePromptVersion,
} from "../../../../../../../lib/api/prompt-repository.ts";
import {
  AuthConfigurationError,
  getUserFromRequest,
} from "../../../../../../../lib/auth/session.ts";
import {
  getBusinessDateKey,
  getRequestIp,
} from "../../../../../../../lib/auth/request-ip.ts";

type RouteParams = {
  slug: string;
  versionNo: string;
};

type RouteContext = {
  params: Promise<RouteParams>;
};

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
  const interaction = await markPromptVersionDailyInteraction({
    slug,
    versionNo,
    action: "like",
    ip: getRequestIp(request),
    dateKey: getBusinessDateKey(),
  });
  if (interaction === "not_found") {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }
  if (interaction === "limited") {
    return NextResponse.json({ error: "今日该卡片已操作：点赞" }, { status: 429 });
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

  const result = await unlikePromptVersion(slug, versionNo, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
