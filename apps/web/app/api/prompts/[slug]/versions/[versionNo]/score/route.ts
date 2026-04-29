import { NextResponse } from "next/server.js";

import {
  markPromptVersionDailyInteraction,
  scorePromptVersion,
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

type ScoreRequestBody = {
  scene?: unknown;
  traceId?: unknown;
  score?: unknown;
};

function normalizeScene(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function normalizeTraceId(input: unknown): string | undefined {
  if (typeof input !== "string") {
    return undefined;
  }
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeScore(input: unknown): number | null {
  if (typeof input !== "number" || !Number.isInteger(input)) {
    return null;
  }
  if (input < 1 || input > 5) {
    return null;
  }
  return input;
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

  let body: ScoreRequestBody;
  try {
    body = (await request.json()) as ScoreRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const scene = normalizeScene(body.scene);
  if (!scene) {
    return NextResponse.json({ error: "scene is required" }, { status: 400 });
  }

  const score = normalizeScore(body.score);
  if (score === null) {
    return NextResponse.json({ error: "score must be an integer between 1 and 5" }, { status: 400 });
  }

  const interaction = await markPromptVersionDailyInteraction({
    slug,
    versionNo,
    action: "score",
    ip: getRequestIp(request),
    dateKey: getBusinessDateKey(),
  });
  if (interaction === "not_found") {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }
  if (interaction === "limited") {
    return NextResponse.json({ error: "今日该卡片已操作：评分" }, { status: 429 });
  }
  if (interaction === "missing_infrastructure") {
    return NextResponse.json(
      {
        error: "评分点赞限流基础设施未就绪",
        code: "missing_infrastructure",
      },
      { status: 500 },
    );
  }

  const result = await scorePromptVersion(slug, versionNo, userEmail, {
    scene,
    traceId: normalizeTraceId(body.traceId),
    score,
  });
  if (!result) {
    return NextResponse.json({ error: "prompt version not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
