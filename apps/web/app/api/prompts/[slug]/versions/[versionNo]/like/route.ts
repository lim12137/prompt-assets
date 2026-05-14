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

function getVersionLikeUserEmail(request: Request): string {
  let user;
  try {
    user = getUserFromRequest(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      user = null;
    } else {
      throw error;
    }
  }

  const requestIp = getRequestIp(request);
  return user?.uid ?? `anonymous+${requestIp.replace(/[^a-zA-Z0-9]/g, "-")}@ip.local`;
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

  const requestIp = getRequestIp(request);
  const userEmail = getVersionLikeUserEmail(request);
  const interaction = await markPromptVersionDailyInteraction({
    slug,
    versionNo,
    action: "like",
    ip: requestIp,
    dateKey: getBusinessDateKey(),
  });
  if (interaction.result === "not_found") {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }
  if (interaction.result === "limited") {
    return NextResponse.json({ error: "今日该卡片已操作：点赞" }, { status: 429 });
  }
  if (interaction.result === "missing_infrastructure") {
    return NextResponse.json(
      {
        error: "评分点赞限流基础设施未就绪",
        code: "missing_infrastructure",
      },
      { status: 500 },
    );
  }

  const result = await likePromptVersion(slug, versionNo, userEmail, interaction.target);
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

  const userEmail = getVersionLikeUserEmail(request);

  const result = await unlikePromptVersion(slug, versionNo, userEmail);
  if (!result) {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
