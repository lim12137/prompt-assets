import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
const require = createRequire(import.meta.url);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function dedupeSlugs(slugs) {
  const seen = new Set();
  const normalized = [];

  for (const slug of slugs) {
    const value = typeof slug === "string" ? slug.trim() : "";
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function parseCleanupRealDbSamplePromptsArgs(argv) {
  const parsed = {
    mode: null,
    slugArgs: [],
    inputPath: null,
    operator: null,
    reason: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") {
      if (parsed.mode) {
        throw new Error("只能二选一：--dry-run 或 --confirm");
      }
      parsed.mode = "dry-run";
      continue;
    }

    if (token === "--confirm") {
      if (parsed.mode) {
        throw new Error("只能二选一：--dry-run 或 --confirm");
      }
      parsed.mode = "confirm";
      continue;
    }

    if (token === "--slug") {
      const slug = argv[index + 1];
      if (!isNonEmptyString(slug)) {
        throw new Error("--slug 需要显式值");
      }
      parsed.slugArgs.push(slug.trim());
      index += 1;
      continue;
    }

    if (token === "--input") {
      const inputPath = argv[index + 1];
      if (!isNonEmptyString(inputPath)) {
        throw new Error("--input 需要文件路径");
      }
      parsed.inputPath = inputPath.trim();
      index += 1;
      continue;
    }

    if (token === "--operator") {
      const operator = argv[index + 1];
      if (!isNonEmptyString(operator)) {
        throw new Error("--operator 需要显式值");
      }
      parsed.operator = operator.trim();
      index += 1;
      continue;
    }

    if (token === "--reason") {
      const reason = argv[index + 1];
      if (!isNonEmptyString(reason)) {
        throw new Error("--reason 需要显式值");
      }
      parsed.reason = reason.trim();
      index += 1;
      continue;
    }

    throw new Error(`不支持的参数: ${token}`);
  }

  if (!parsed.mode) {
    throw new Error("必须指定 --dry-run 或 --confirm");
  }

  if (parsed.mode === "confirm" && (!parsed.operator || !parsed.reason)) {
    throw new Error("--confirm 必须同时提供 --operator 和 --reason");
  }

  return parsed;
}

export async function loadExplicitSlugList({ slugArgs, inputPath, cwd = process.cwd() }) {
  const collected = [...(Array.isArray(slugArgs) ? slugArgs : [])];

  if (inputPath) {
    const absolutePath = path.resolve(cwd, inputPath);
    const raw = await readFile(absolutePath, "utf-8");
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      collected.push(...parsed);
    } else if (Array.isArray(parsed?.slugs)) {
      collected.push(...parsed.slugs);
    } else {
      throw new Error("输入文件必须是 slug 清单数组，或包含 slugs 数组字段");
    }
  }

  const slugs = dedupeSlugs(collected);
  if (slugs.length === 0) {
    throw new Error("必须提供显式 slug 清单");
  }

  return slugs;
}

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function resolveCleanupDatabaseUrl(env = process.env) {
  const explicitUrl = toNonEmptyString(env.DATABASE_URL);
  if (explicitUrl) {
    return explicitUrl;
  }

  const host = toNonEmptyString(env.POSTGRES_HOST) ?? "127.0.0.1";
  const port = toNonEmptyString(env.POSTGRES_PORT) ?? "5432";
  const database = toNonEmptyString(env.POSTGRES_DB) ?? "prompt_management";
  const user = toNonEmptyString(env.POSTGRES_USER) ?? "postgres";
  const password = toNonEmptyString(env.POSTGRES_PASSWORD) ?? "postgres";

  return `postgres://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export async function withCleanupPgClient(connectionString, run) {
  let Client;

  try {
    ({ Client } = require("../packages/db/node_modules/pg"));
  } catch (error) {
    throw new Error(
      `未找到 PostgreSQL 驱动，请先安装仓库依赖后再执行。原始错误: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

function asNumber(value) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return Number(value);
  }
  return 0;
}

function normalizeCategorySlugs(rawValue, primaryCategorySlug) {
  if (!Array.isArray(rawValue)) {
    return primaryCategorySlug ? [primaryCategorySlug] : [];
  }

  const slugs = dedupeSlugs(rawValue);
  if (primaryCategorySlug && !slugs.includes(primaryCategorySlug)) {
    return [primaryCategorySlug, ...slugs];
  }
  return slugs;
}

function mapPromptCleanupSummary(row) {
  const primaryCategorySlug =
    typeof row.primary_category_slug === "string" ? row.primary_category_slug : "";

  return {
    promptId: asNumber(row.id),
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    primaryCategorySlug,
    categorySlugs: normalizeCategorySlugs(row.category_slugs_json, primaryCategorySlug),
    counts: {
      versions: asNumber(row.version_count),
      submissions: asNumber(row.submission_count),
      promptLikes: asNumber(row.prompt_like_count),
      versionLikes: asNumber(row.version_like_count),
      versionScores: asNumber(row.version_score_count),
      versionDailyInteractions: asNumber(row.version_daily_interaction_count),
    },
  };
}

function summarizeTotals(prompts) {
  return prompts.reduce(
    (summary, prompt) => ({
      promptCount: summary.promptCount + 1,
      versionCount: summary.versionCount + prompt.counts.versions,
      submissionCount: summary.submissionCount + prompt.counts.submissions,
      promptLikeCount: summary.promptLikeCount + prompt.counts.promptLikes,
      versionLikeCount: summary.versionLikeCount + prompt.counts.versionLikes,
      versionScoreCount: summary.versionScoreCount + prompt.counts.versionScores,
      versionDailyInteractionCount:
        summary.versionDailyInteractionCount + prompt.counts.versionDailyInteractions,
    }),
    {
      promptCount: 0,
      versionCount: 0,
      submissionCount: 0,
      promptLikeCount: 0,
      versionLikeCount: 0,
      versionScoreCount: 0,
      versionDailyInteractionCount: 0,
    },
  );
}

export async function fetchPromptCleanupSummaries(client, slugs) {
  const result = await client.query(
    `
      SELECT p.id,
             p.slug,
             p.title,
             p.summary,
             p.status,
             primary_category.slug AS primary_category_slug,
             COALESCE(
               (
                 SELECT json_agg(category_slug ORDER BY category_slug)
                 FROM (
                   SELECT c.slug AS category_slug
                   FROM prompt_categories pc
                   INNER JOIN categories c ON c.id = pc.category_id
                   WHERE pc.prompt_id = p.id
                 ) category_slugs
               ),
               '[]'::json
             ) AS category_slugs_json,
             (
               SELECT COUNT(*)::int
               FROM prompt_versions pv
               WHERE pv.prompt_id = p.id
             ) AS version_count,
             (
               SELECT COUNT(*)::int
               FROM submissions s
               WHERE s.prompt_id = p.id
             ) AS submission_count,
             (
               SELECT COUNT(*)::int
               FROM prompt_likes pl
               WHERE pl.prompt_id = p.id
             ) AS prompt_like_count,
             (
               SELECT COUNT(*)::int
               FROM prompt_version_likes pvl
               INNER JOIN prompt_versions pv ON pv.id = pvl.prompt_version_id
               WHERE pv.prompt_id = p.id
             ) AS version_like_count,
             (
               SELECT COUNT(*)::int
               FROM prompt_version_scores pvs
               INNER JOIN prompt_versions pv ON pv.id = pvs.prompt_version_id
               WHERE pv.prompt_id = p.id
             ) AS version_score_count,
             (
               SELECT COUNT(*)::int
               FROM prompt_version_daily_interactions pvdi
               INNER JOIN prompt_versions pv ON pv.id = pvdi.prompt_version_id
               WHERE pv.prompt_id = p.id
             ) AS version_daily_interaction_count
      FROM prompts p
      INNER JOIN categories primary_category ON primary_category.id = p.category_id
      WHERE p.slug = ANY($1::text[])
      ORDER BY p.slug ASC;
    `,
    [slugs],
  );

  return result.rows.map(mapPromptCleanupSummary);
}

async function deletePromptBatch(client, prompts, auditContext) {
  const promptIds = prompts.map((prompt) => prompt.promptId);

  await client.query("BEGIN");

  try {
    await client.query("DELETE FROM submissions WHERE prompt_id = ANY($1::int[]);", [promptIds]);
    await client.query(
      "UPDATE prompts SET current_version_id = NULL WHERE id = ANY($1::int[]);",
      [promptIds],
    );
    const deleted = await client.query(
      "DELETE FROM prompts WHERE id = ANY($1::int[]) RETURNING slug;",
      [promptIds],
    );

    await client.query(
      "INSERT INTO audit_logs (actor_id, action, target_type, target_id, payload_json) VALUES ($1, $2, $3, $4, $5::jsonb);",
      [
        null,
        "prompt.sample_cleanup.executed",
        "prompt_cleanup_batch",
        0,
        JSON.stringify({
          operator: auditContext.operator,
          reason: auditContext.reason,
          executedAt: auditContext.executedAt,
          deletedSlugs: deleted.rows.map((row) => row.slug),
          prompts: prompts.map((prompt) => ({
            slug: prompt.slug,
            title: prompt.title,
            status: prompt.status,
          })),
          summary: summarizeTotals(prompts),
        }),
      ],
    );

    await client.query("COMMIT");
    return deleted.rows.map((row) => row.slug);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

function buildDryRunPayload(slugs, prompts) {
  const foundSlugs = new Set(prompts.map((prompt) => prompt.slug));
  const missingSlugs = slugs.filter((slug) => !foundSlugs.has(slug));

  return {
    mode: "dry-run",
    ready: missingSlugs.length === 0 && prompts.length > 0,
    requestedSlugs: slugs,
    foundCount: prompts.length,
    missingSlugs,
    prompts: prompts.map((prompt) => ({
      slug: prompt.slug,
      title: prompt.title,
      status: prompt.status,
      summary: prompt.summary,
      primaryCategorySlug: prompt.primaryCategorySlug,
      categorySlugs: prompt.categorySlugs,
      counts: prompt.counts,
    })),
    summary: summarizeTotals(prompts),
  };
}

export async function runCleanupRealDbSamplePrompts({
  argv = process.argv.slice(2),
  stdout = process.stdout,
  stderr = process.stderr,
  cwd = process.cwd(),
  connectionString = resolveCleanupDatabaseUrl(process.env),
  withPgClientImpl = withCleanupPgClient,
  now = () => new Date(),
} = {}) {
  try {
    const args = parseCleanupRealDbSamplePromptsArgs(argv);
    const slugs = await loadExplicitSlugList({
      slugArgs: args.slugArgs,
      inputPath: args.inputPath,
      cwd,
    });

    const payload = await withPgClientImpl(connectionString, async (client) => {
      const prompts = await fetchPromptCleanupSummaries(client, slugs);

      if (args.mode === "dry-run") {
        return buildDryRunPayload(slugs, prompts);
      }

      const preview = buildDryRunPayload(slugs, prompts);
      if (!preview.ready) {
        throw new Error(
          `待删除对象未就绪，请先修正 slug 清单。missing: ${preview.missingSlugs.join(", ")}`,
        );
      }

      const executedAt = now().toISOString();
      const deletedSlugs = await deletePromptBatch(client, prompts, {
        operator: args.operator,
        reason: args.reason,
        executedAt,
      });

      return {
        mode: "confirm",
        deleted: true,
        operator: args.operator,
        reason: args.reason,
        executedAt,
        requestedSlugs: slugs,
        deletedSlugs,
        prompts: prompts.map((prompt) => ({
          slug: prompt.slug,
          title: prompt.title,
          status: prompt.status,
        })),
        summary: summarizeTotals(prompts),
      };
    });

    stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.write(`[cleanup-real-db-sample-prompts] ${message}\n`);
    return 1;
  }
}

async function main() {
  const exitCode = await runCleanupRealDbSamplePrompts();
  process.exitCode = exitCode;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
