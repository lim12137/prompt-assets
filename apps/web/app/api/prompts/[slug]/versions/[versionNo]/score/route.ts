import { NextResponse } from "next/server.js";

import { scorePromptVersion } from "../../../../../../../lib/api/prompt-repository.ts";

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

  const userEmail = resolveUserEmail(request);
  if (!isValidEmail(userEmail)) {
    return NextResponse.json({ error: "invalid user email" }, { status: 400 });
  }

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
