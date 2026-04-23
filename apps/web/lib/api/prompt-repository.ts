import {
  databaseUrl,
  isPgReachable,
  withPgClient,
} from "../../../../packages/db/src/client.ts";
import {
  baseCategories,
  pendingSubmissionFixture,
  promptCatalog,
} from "../../../../tests/fixtures/prompts.ts";
import {
  mapPromptDetail,
  mapPromptListItem,
  type PromptDetailDto,
  type PromptDetailRaw,
  type PromptListItemDto,
  type PromptVersionStatus,
  type PromptVersionRaw,
} from "./prompt-mappers.ts";

type SqlClient = {
  query: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
};

type ListPromptsQuery = {
  category?: string;
  keyword?: string;
  sort?: string;
};

type PromptSort = "latest" | "popular" | "liked";

export type PromptLikeMutationResult = {
  slug: string;
  likesCount: number;
  liked: boolean;
};

type DbPromptListRow = {
  slug: string;
  title: string;
  summary: string;
  likes_count: number | string;
  updated_at: string | Date;
  category_slug: string;
  category_name: string;
};

type DbPromptDetailHeadRow = {
  id: number | string;
  slug: string;
  title: string;
  summary: string;
  likes_count: number | string;
  updated_at: string | Date;
  current_version_id: number | string | null;
  category_slug: string;
  category_name: string;
  current_version_no: string | null;
  current_source_type: string | null;
  current_submitted_at: string | Date | null;
  current_content: string | null;
};

type DbPromptDetailVersionRow = {
  id: number | string;
  version_no: string;
  content: string;
  source_type: string;
  submitted_at: string | Date;
  submission_status: PromptVersionStatus | null;
};

type DbPromptLookupRow = {
  id: number | string;
};

type DbUserRow = {
  id: number | string;
};

type DbPromptLikesCountRow = {
  likes_count: number | string;
};

const CATEGORY_MAP = new Map(baseCategories.map((item) => [item.slug, item]));
const REQUIRED_TABLES = [
  "users",
  "categories",
  "prompts",
  "prompt_versions",
  "submissions",
  "prompt_likes",
];
let cachedDbReadable:
  | {
      at: number;
      value: boolean;
    }
  | undefined;
let fixturePromptLikes = createFixtureLikeState();

function createFixtureLikeState(): Map<string, Set<string>> {
  return new Map(
    promptCatalog
      .filter((prompt) => prompt.status !== "archived")
      .map((prompt) => [prompt.slug, new Set(prompt.likesByEmails ?? [])]),
  );
}

function normalizeSort(sort?: string): PromptSort {
  if (sort === "popular" || sort === "liked") {
    return sort;
  }
  return "latest";
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

function normalizeUserEmail(input: string): string {
  return input.trim().toLowerCase();
}

function getFixturePromptLikes(slug: string): Set<string> | null {
  const likes = fixturePromptLikes.get(slug);
  return likes ?? null;
}

function getFixtureLikesCount(slug: string): number {
  return getFixturePromptLikes(slug)?.size ?? 0;
}

function buildFixtureTimestamp(index: number): string {
  const base = Date.UTC(2026, 0, 1, 0, 0, 0);
  return new Date(base + index * 86_400_000).toISOString();
}

function compareVersionNoDesc(left: string, right: string): number {
  const toInt = (value: string) => Number(value.replace(/^v/i, ""));
  return toInt(right) - toInt(left);
}

async function hasPromptTables(client: SqlClient): Promise<boolean> {
  const result = await client.query<{ name: string }>(
    `
      SELECT unnest($1::text[]) AS name
      EXCEPT
      SELECT tablename AS name
      FROM pg_tables
      WHERE schemaname = 'public';
    `,
    [REQUIRED_TABLES],
  );
  return result.rows.length === 0;
}

async function canReadFromDatabase(): Promise<boolean> {
  const now = Date.now();
  if (cachedDbReadable && now - cachedDbReadable.at < 5000) {
    return cachedDbReadable.value;
  }

  if (!(await isPgReachable(databaseUrl, 400))) {
    cachedDbReadable = { at: now, value: false };
    return false;
  }

  try {
    const hasTables = await withPgClient(databaseUrl, async (client) =>
      hasPromptTables(client),
    );
    cachedDbReadable = { at: now, value: hasTables };
    return hasTables;
  } catch {
    cachedDbReadable = { at: now, value: false };
    return false;
  }
}

async function listPromptsFromDb(
  query: ListPromptsQuery,
): Promise<PromptListItemDto[]> {
  const conditions = [`p.status = 'published'`];
  const params: unknown[] = [];
  const sort = normalizeSort(query.sort);

  if (query.category) {
    params.push(query.category);
    conditions.push(`c.slug = $${params.length}`);
  }

  if (query.keyword) {
    params.push(`%${query.keyword}%`);
    conditions.push(
      `(p.title ILIKE $${params.length} OR p.summary ILIKE $${params.length})`,
    );
  }

  const orderBy =
    sort === "latest"
      ? `p.updated_at DESC, p.id DESC`
      : `p.likes_count DESC, p.updated_at DESC, p.id DESC`;

  return withPgClient(databaseUrl, async (client) => {
    const result = await client.query<DbPromptListRow>(
      `
        SELECT
          p.slug,
          p.title,
          p.summary,
          p.likes_count,
          p.updated_at,
          c.slug AS category_slug,
          c.name AS category_name
        FROM prompts p
        INNER JOIN categories c ON c.id = p.category_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${orderBy};
      `,
      params,
    );

    return result.rows.map((row) =>
      mapPromptListItem({
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        likesCount: asNumber(row.likes_count),
        updatedAt: row.updated_at,
        categorySlug: row.category_slug,
        categoryName: row.category_name,
      }),
    );
  });
}

function listPromptsFromFixtures(query: ListPromptsQuery): PromptListItemDto[] {
  const sort = normalizeSort(query.sort);
  const keyword = query.keyword?.trim().toLowerCase();

  const rows = promptCatalog
    .filter((prompt) => prompt.status !== "archived")
    .map((prompt, index) =>
      mapPromptListItem({
        slug: prompt.slug,
        title: prompt.title,
        summary: prompt.summary,
        likesCount: getFixtureLikesCount(prompt.slug),
        updatedAt: buildFixtureTimestamp(index),
        categorySlug: prompt.categorySlug,
        categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? "",
      }),
    )
    .filter((item) => {
      if (query.category && item.categorySlug !== query.category) {
        return false;
      }
      if (!keyword) {
        return true;
      }
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.summary.toLowerCase().includes(keyword)
      );
    });

  if (sort === "latest") {
    rows.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  } else {
    rows.sort((left, right) => {
      if (right.likesCount !== left.likesCount) {
        return right.likesCount - left.likesCount;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }

  return rows;
}

function getFixtureVersionStatus(
  promptSlug: string,
  versionNo: string,
  currentVersionNo: string,
): PromptVersionStatus {
  if (versionNo === currentVersionNo) {
    return "approved";
  }

  const linkedSubmission = pendingSubmissionFixture.find(
    (item) =>
      item.promptSlug === promptSlug && item.candidateVersionNo === versionNo,
  );

  if (!linkedSubmission) {
    return "approved";
  }

  if (linkedSubmission.status === "rejected") {
    return "rejected";
  }

  if (linkedSubmission.status === "pending") {
    return "pending";
  }

  return "approved";
}

function getPromptDetailFromFixtures(slug: string): PromptDetailDto | null {
  const prompt = promptCatalog.find((item) => item.slug === slug);
  if (!prompt || prompt.status === "archived") {
    return null;
  }

  const currentVersion = prompt.versions.find(
    (version) => version.versionNo === prompt.currentVersionNo,
  );
  if (!currentVersion) {
    return null;
  }

  const versions: PromptVersionRaw[] = [...prompt.versions]
    .sort((left, right) => compareVersionNoDesc(left.versionNo, right.versionNo))
    .map((version, index) => ({
      versionNo: version.versionNo,
      sourceType: version.sourceType ?? "edit",
      status: getFixtureVersionStatus(
        prompt.slug,
        version.versionNo,
        prompt.currentVersionNo,
      ),
      submittedAt: buildFixtureTimestamp(index),
      content: version.content,
    }));

  const raw: PromptDetailRaw = {
    slug: prompt.slug,
    title: prompt.title,
    summary: prompt.summary,
    likesCount: getFixtureLikesCount(prompt.slug),
    updatedAt: buildFixtureTimestamp(promptCatalog.indexOf(prompt)),
    categorySlug: prompt.categorySlug,
    categoryName: CATEGORY_MAP.get(prompt.categorySlug)?.name ?? "",
    currentVersionNo: currentVersion.versionNo,
    currentVersionSourceType: currentVersion.sourceType ?? "edit",
    currentVersionSubmittedAt: buildFixtureTimestamp(0),
    currentVersionContent: currentVersion.content,
    versions,
  };

  return mapPromptDetail(raw);
}

async function getPromptDetailFromDb(slug: string): Promise<PromptDetailDto | null> {
  return withPgClient(databaseUrl, async (client) => {
    const headResult = await client.query<DbPromptDetailHeadRow>(
      `
        SELECT
          p.id,
          p.slug,
          p.title,
          p.summary,
          p.likes_count,
          p.updated_at,
          p.current_version_id,
          c.slug AS category_slug,
          c.name AS category_name,
          cv.version_no AS current_version_no,
          cv.source_type AS current_source_type,
          cv.submitted_at AS current_submitted_at,
          cv.content AS current_content
        FROM prompts p
        INNER JOIN categories c ON c.id = p.category_id
        LEFT JOIN prompt_versions cv ON cv.id = p.current_version_id
        WHERE p.slug = $1 AND p.status = 'published'
        LIMIT 1;
      `,
      [slug],
    );

    const head = headResult.rows[0];
    if (!head) {
      return null;
    }

    const versionsResult = await client.query<DbPromptDetailVersionRow>(
      `
        SELECT
          v.id,
          v.version_no,
          v.content,
          v.source_type,
          v.submitted_at,
          s.status AS submission_status
        FROM prompt_versions v
        LEFT JOIN submissions s ON s.candidate_version_id = v.id
        WHERE v.prompt_id = $1
        ORDER BY v.created_at DESC, v.id DESC;
      `,
      [head.id],
    );

    const currentVersionId = asNumber(head.current_version_id);
    const versions: PromptVersionRaw[] = versionsResult.rows.map((row) => {
      const versionId = asNumber(row.id);
      let status: PromptVersionStatus = "approved";

      if (versionId === currentVersionId && currentVersionId > 0) {
        status = "approved";
      } else if (row.submission_status === "pending") {
        status = "pending";
      } else if (row.submission_status === "rejected") {
        status = "rejected";
      }

      return {
        versionNo: row.version_no,
        sourceType: row.source_type,
        status,
        submittedAt: row.submitted_at,
        content: row.content,
      };
    });

    const currentFallback = versions.find((item) => item.status === "approved");
    const currentVersionNo =
      head.current_version_no ?? currentFallback?.versionNo ?? "v0001";
    const currentVersionSourceType =
      head.current_source_type ?? currentFallback?.sourceType ?? "edit";
    const currentVersionSubmittedAt =
      head.current_submitted_at ?? currentFallback?.submittedAt ?? new Date(0);
    const currentVersionContent =
      head.current_content ?? currentFallback?.content ?? "";

    return mapPromptDetail({
      slug: head.slug,
      title: head.title,
      summary: head.summary,
      likesCount: asNumber(head.likes_count),
      updatedAt: head.updated_at,
      categorySlug: head.category_slug,
      categoryName: head.category_name,
      currentVersionNo,
      currentVersionSourceType,
      currentVersionSubmittedAt,
      currentVersionContent,
      versions,
    });
  });
}

async function findPublishedPromptId(
  client: SqlClient,
  slug: string,
): Promise<number | null> {
  const result = await client.query<DbPromptLookupRow>(
    `
      SELECT id
      FROM prompts
      WHERE slug = $1 AND status = 'published'
      LIMIT 1;
    `,
    [slug],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return asNumber(row.id);
}

async function upsertUserId(client: SqlClient, email: string): Promise<number> {
  const result = await client.query<DbUserRow>(
    `
      INSERT INTO users (email, role)
      VALUES ($1, 'user')
      ON CONFLICT (email)
      DO UPDATE SET email = EXCLUDED.email
      RETURNING id;
    `,
    [email],
  );

  return asNumber(result.rows[0]?.id);
}

async function readPromptLikesCount(client: SqlClient, promptId: number): Promise<number> {
  const result = await client.query<DbPromptLikesCountRow>(
    `
      SELECT likes_count
      FROM prompts
      WHERE id = $1
      LIMIT 1;
    `,
    [promptId],
  );
  return asNumber(result.rows[0]?.likes_count);
}

async function likePromptInDb(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    const promptId = await findPublishedPromptId(client, slug);
    if (!promptId) {
      return null;
    }
    const userId = await upsertUserId(client, userEmail);

    const inserted = await client.query<DbPromptLookupRow>(
      `
        INSERT INTO prompt_likes (prompt_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (prompt_id, user_id) DO NOTHING
        RETURNING id;
      `,
      [promptId, userId],
    );

    if (inserted.rows.length > 0) {
      await client.query(
        `
          UPDATE prompts
          SET likes_count = likes_count + 1, updated_at = NOW()
          WHERE id = $1;
        `,
        [promptId],
      );
    }

    const likesCount = await readPromptLikesCount(client, promptId);
    return {
      slug,
      likesCount,
      liked: true,
    };
  });
}

async function unlikePromptInDb(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  return withPgClient(databaseUrl, async (client) => {
    const promptId = await findPublishedPromptId(client, slug);
    if (!promptId) {
      return null;
    }
    const userId = await upsertUserId(client, userEmail);

    const deleted = await client.query<DbPromptLookupRow>(
      `
        DELETE FROM prompt_likes
        WHERE prompt_id = $1 AND user_id = $2
        RETURNING id;
      `,
      [promptId, userId],
    );

    if (deleted.rows.length > 0) {
      await client.query(
        `
          UPDATE prompts
          SET likes_count = GREATEST(likes_count - 1, 0), updated_at = NOW()
          WHERE id = $1;
        `,
        [promptId],
      );
    }

    const likesCount = await readPromptLikesCount(client, promptId);
    return {
      slug,
      likesCount,
      liked: false,
    };
  });
}

function likePromptInFixtures(
  slug: string,
  userEmail: string,
): PromptLikeMutationResult | null {
  const prompt = promptCatalog.find(
    (item) => item.slug === slug && item.status !== "archived",
  );
  if (!prompt) {
    return null;
  }

  const normalizedEmail = normalizeUserEmail(userEmail);
  const likes = getFixturePromptLikes(slug) ?? new Set<string>();
  likes.add(normalizedEmail);
  fixturePromptLikes.set(slug, likes);

  return {
    slug,
    likesCount: likes.size,
    liked: true,
  };
}

function unlikePromptInFixtures(
  slug: string,
  userEmail: string,
): PromptLikeMutationResult | null {
  const prompt = promptCatalog.find(
    (item) => item.slug === slug && item.status !== "archived",
  );
  if (!prompt) {
    return null;
  }

  const normalizedEmail = normalizeUserEmail(userEmail);
  const likes = getFixturePromptLikes(slug) ?? new Set<string>();
  likes.delete(normalizedEmail);
  fixturePromptLikes.set(slug, likes);

  return {
    slug,
    likesCount: likes.size,
    liked: false,
  };
}

export function __resetPromptLikeFixtureStateForTests(): void {
  fixturePromptLikes = createFixtureLikeState();
  cachedDbReadable = undefined;
}

export async function likePrompt(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(userEmail);
  if (!normalizedEmail) {
    return null;
  }

  if (await canReadFromDatabase()) {
    return likePromptInDb(slug, normalizedEmail);
  }

  return likePromptInFixtures(slug, normalizedEmail);
}

export async function unlikePrompt(
  slug: string,
  userEmail: string,
): Promise<PromptLikeMutationResult | null> {
  const normalizedEmail = normalizeUserEmail(userEmail);
  if (!normalizedEmail) {
    return null;
  }

  if (await canReadFromDatabase()) {
    return unlikePromptInDb(slug, normalizedEmail);
  }

  return unlikePromptInFixtures(slug, normalizedEmail);
}

export async function listPrompts(
  query: ListPromptsQuery = {},
): Promise<PromptListItemDto[]> {
  if (await canReadFromDatabase()) {
    return listPromptsFromDb(query);
  }
  return listPromptsFromFixtures(query);
}

export async function getPromptDetail(slug: string): Promise<PromptDetailDto | null> {
  if (await canReadFromDatabase()) {
    return getPromptDetailFromDb(slug);
  }
  return getPromptDetailFromFixtures(slug);
}
