import { databaseUrl, withPgClient } from "./client.ts";
import {
  baseCategories,
  pendingSubmissionFixture,
  promptCatalog,
} from "../../../tests/fixtures/prompts.ts";

type SqlClient = {
  query: <T extends Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
};

type SeedUser = {
  email: string;
  role: "user" | "admin";
};

export type SeedSummary = {
  categories: number;
  prompts: number;
  promptVersions: number;
  submissions: number;
  pendingSubmissions: number;
  multiVersionPrompts: number;
};

export type SeedOptions = {
  reset?: boolean;
};

const seedUsers: SeedUser[] = [
  { email: "admin@example.com", role: "admin" },
  { email: "alice@example.com", role: "user" },
  { email: "bob@example.com", role: "user" },
  { email: "carol@example.com", role: "user" },
];

function toPromptVersionKey(promptSlug: string, versionNo: string): string {
  return `${promptSlug}::${versionNo}`;
}

function mustGet<K, V>(map: Map<K, V>, key: K, message: string): V {
  const value = map.get(key);
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
}

function buildSeedPlan(): SeedSummary {
  const promptVersions = promptCatalog.reduce(
    (acc, prompt) => acc + prompt.versions.length,
    0,
  );
  const pendingSubmissions = pendingSubmissionFixture.filter(
    (item) => item.status === "pending",
  ).length;
  const multiVersionPrompts = promptCatalog.filter(
    (item) => item.versions.length >= 2,
  ).length;

  return {
    categories: baseCategories.length,
    prompts: promptCatalog.length,
    promptVersions,
    submissions: pendingSubmissionFixture.length,
    pendingSubmissions,
    multiVersionPrompts,
  };
}

export const seedPlan = buildSeedPlan();

async function resetSeedTables(client: SqlClient): Promise<void> {
  await client.query(`
    TRUNCATE TABLE
      "submissions",
      "prompt_likes",
      "prompt_versions",
      "prompts",
      "categories",
      "audit_logs",
      "users"
    RESTART IDENTITY CASCADE;
  `);
}

async function upsertUsers(client: SqlClient): Promise<Map<string, number>> {
  const userIds = new Map<string, number>();

  for (const user of seedUsers) {
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO "users" ("email", "role")
        VALUES ($1, $2)
        ON CONFLICT ("email")
        DO UPDATE SET "role" = EXCLUDED."role"
        RETURNING "id";
      `,
      [user.email, user.role],
    );

    userIds.set(user.email, Number(result.rows[0]?.id));
  }

  return userIds;
}

async function upsertCategories(client: SqlClient): Promise<Map<string, number>> {
  const categoryIds = new Map<string, number>();

  for (const category of baseCategories) {
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO "categories" ("name", "slug", "sort_order", "status")
        VALUES ($1, $2, $3, $4)
        ON CONFLICT ("slug")
        DO UPDATE
        SET
          "name" = EXCLUDED."name",
          "sort_order" = EXCLUDED."sort_order",
          "status" = EXCLUDED."status"
        RETURNING "id";
      `,
      [category.name, category.slug, category.sortOrder, category.status ?? "active"],
    );

    categoryIds.set(category.slug, Number(result.rows[0]?.id));
  }

  return categoryIds;
}

async function upsertPrompts(
  client: SqlClient,
  categoryIds: Map<string, number>,
): Promise<Map<string, number>> {
  const promptIds = new Map<string, number>();

  for (const prompt of promptCatalog) {
    const categoryId = mustGet(
      categoryIds,
      prompt.categorySlug,
      `未找到分类: ${prompt.categorySlug}`,
    );
    const likesCount = prompt.likesByEmails?.length ?? 0;
    const result = await client.query<{ id: number }>(
      `
        INSERT INTO "prompts"
          ("slug", "title", "summary", "category_id", "likes_count", "status")
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("slug")
        DO UPDATE
        SET
          "title" = EXCLUDED."title",
          "summary" = EXCLUDED."summary",
          "category_id" = EXCLUDED."category_id",
          "likes_count" = EXCLUDED."likes_count",
          "status" = EXCLUDED."status",
          "updated_at" = NOW()
        RETURNING "id";
      `,
      [
        prompt.slug,
        prompt.title,
        prompt.summary,
        categoryId,
        likesCount,
        prompt.status ?? "published",
      ],
    );

    promptIds.set(prompt.slug, Number(result.rows[0]?.id));
  }

  return promptIds;
}

async function upsertPromptVersions(
  client: SqlClient,
  promptIds: Map<string, number>,
  userIds: Map<string, number>,
): Promise<Map<string, number>> {
  const versionIds = new Map<string, number>();

  for (const prompt of promptCatalog) {
    const promptId = mustGet(promptIds, prompt.slug, `未找到 Prompt: ${prompt.slug}`);

    for (const version of prompt.versions) {
      const submittedBy = version.submittedByEmail
        ? mustGet(
            userIds,
            version.submittedByEmail,
            `未找到提交用户: ${version.submittedByEmail}`,
          )
        : null;
      const result = await client.query<{ id: number }>(
        `
          INSERT INTO "prompt_versions"
            ("prompt_id", "version_no", "content", "change_note", "source_type", "submitted_by")
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT ("prompt_id", "version_no")
          DO UPDATE
          SET
            "content" = EXCLUDED."content",
            "change_note" = EXCLUDED."change_note",
            "source_type" = EXCLUDED."source_type",
            "submitted_by" = EXCLUDED."submitted_by"
          RETURNING "id";
        `,
        [
          promptId,
          version.versionNo,
          version.content,
          version.changeNote ?? null,
          version.sourceType ?? "edit",
          submittedBy,
        ],
      );

      versionIds.set(
        toPromptVersionKey(prompt.slug, version.versionNo),
        Number(result.rows[0]?.id),
      );
    }
  }

  return versionIds;
}

async function updateCurrentVersions(
  client: SqlClient,
  promptIds: Map<string, number>,
  versionIds: Map<string, number>,
): Promise<void> {
  for (const prompt of promptCatalog) {
    const promptId = mustGet(promptIds, prompt.slug, `未找到 Prompt: ${prompt.slug}`);
    const currentVersionId = mustGet(
      versionIds,
      toPromptVersionKey(prompt.slug, prompt.currentVersionNo),
      `未找到当前版本: ${prompt.slug}@${prompt.currentVersionNo}`,
    );

    await client.query(
      `
        UPDATE "prompts"
        SET "current_version_id" = $2, "updated_at" = NOW()
        WHERE "id" = $1;
      `,
      [promptId, currentVersionId],
    );
  }
}

async function upsertSubmissions(
  client: SqlClient,
  promptIds: Map<string, number>,
  versionIds: Map<string, number>,
  userIds: Map<string, number>,
): Promise<void> {
  for (const submission of pendingSubmissionFixture) {
    const promptId = mustGet(
      promptIds,
      submission.promptSlug,
      `未找到 Prompt: ${submission.promptSlug}`,
    );
    const baseVersionId = mustGet(
      versionIds,
      toPromptVersionKey(submission.promptSlug, submission.baseVersionNo),
      `未找到基础版本: ${submission.promptSlug}@${submission.baseVersionNo}`,
    );
    const candidateVersionId = mustGet(
      versionIds,
      toPromptVersionKey(submission.promptSlug, submission.candidateVersionNo),
      `未找到候选版本: ${submission.promptSlug}@${submission.candidateVersionNo}`,
    );
    const submitterId = mustGet(
      userIds,
      submission.submitterEmail,
      `未找到提交者: ${submission.submitterEmail}`,
    );

    await client.query(
      `
        INSERT INTO "submissions"
          (
            "prompt_id",
            "base_version_id",
            "candidate_version_id",
            "submitter_id",
            "status",
            "review_comment"
          )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT ("candidate_version_id")
        DO UPDATE
        SET
          "prompt_id" = EXCLUDED."prompt_id",
          "base_version_id" = EXCLUDED."base_version_id",
          "submitter_id" = EXCLUDED."submitter_id",
          "status" = EXCLUDED."status",
          "review_comment" = EXCLUDED."review_comment",
          "updated_at" = NOW();
      `,
      [
        promptId,
        baseVersionId,
        candidateVersionId,
        submitterId,
        submission.status,
        submission.reviewComment ?? null,
      ],
    );
  }
}

async function upsertPromptLikes(
  client: SqlClient,
  promptIds: Map<string, number>,
  userIds: Map<string, number>,
): Promise<void> {
  for (const prompt of promptCatalog) {
    const promptId = mustGet(promptIds, prompt.slug, `未找到 Prompt: ${prompt.slug}`);
    const likesByEmails = prompt.likesByEmails ?? [];

    for (const email of likesByEmails) {
      const userId = mustGet(userIds, email, `未找到点赞用户: ${email}`);
      await client.query(
        `
          INSERT INTO "prompt_likes" ("prompt_id", "user_id")
          VALUES ($1, $2)
          ON CONFLICT ("prompt_id", "user_id") DO NOTHING;
        `,
        [promptId, userId],
      );
    }
  }

  await client.query(`
    UPDATE "prompts" p
    SET "likes_count" = COALESCE(l.cnt, 0)
    FROM (
      SELECT "prompt_id", COUNT(*)::integer AS cnt
      FROM "prompt_likes"
      GROUP BY "prompt_id"
    ) l
    WHERE p.id = l.prompt_id;
  `);

  await client.query(`
    UPDATE "prompts"
    SET "likes_count" = 0
    WHERE "id" NOT IN (SELECT "prompt_id" FROM "prompt_likes");
  `);
}

export async function seedDatabase(
  connectionString: string = databaseUrl,
  options: SeedOptions = {},
): Promise<SeedSummary> {
  const reset = options.reset ?? true;

  await withPgClient(connectionString, async (client) => {
    await client.query("BEGIN;");

    try {
      if (reset) {
        await resetSeedTables(client);
      }

      const userIds = await upsertUsers(client);
      const categoryIds = await upsertCategories(client);
      const promptIds = await upsertPrompts(client, categoryIds);
      const versionIds = await upsertPromptVersions(client, promptIds, userIds);

      await updateCurrentVersions(client, promptIds, versionIds);
      await upsertSubmissions(client, promptIds, versionIds, userIds);
      await upsertPromptLikes(client, promptIds, userIds);

      await client.query("COMMIT;");
    } catch (error) {
      await client.query("ROLLBACK;");
      throw error;
    }
  });

  return seedPlan;
}
