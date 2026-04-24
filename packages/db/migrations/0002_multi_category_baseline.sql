ALTER TABLE "categories"
  ADD COLUMN "is_system" boolean NOT NULL DEFAULT false,
  ADD COLUMN "is_selectable" boolean NOT NULL DEFAULT true,
  ADD COLUMN "is_collapsed_by_default" boolean NOT NULL DEFAULT false,
  ADD COLUMN "updated_at" timestamp NOT NULL DEFAULT now();

CREATE TABLE "prompt_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_id" integer NOT NULL,
  "category_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "prompt_categories_prompt_id_category_id_key"
  ON "prompt_categories" USING btree ("prompt_id", "category_id");

CREATE INDEX "prompt_categories_category_id_prompt_id_idx"
  ON "prompt_categories" USING btree ("category_id", "prompt_id");

ALTER TABLE "prompt_categories"
  ADD CONSTRAINT "prompt_categories_prompt_id_prompts_id_fk"
  FOREIGN KEY ("prompt_id")
  REFERENCES "public"."prompts"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

ALTER TABLE "prompt_categories"
  ADD CONSTRAINT "prompt_categories_category_id_categories_id_fk"
  FOREIGN KEY ("category_id")
  REFERENCES "public"."categories"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

INSERT INTO "prompt_categories" ("prompt_id", "category_id")
SELECT p.id, p.category_id
FROM "prompts" p
ON CONFLICT ("prompt_id", "category_id") DO NOTHING;

INSERT INTO "categories" (
  "name",
  "slug",
  "sort_order",
  "status",
  "is_system",
  "is_selectable",
  "is_collapsed_by_default",
  "updated_at"
)
VALUES (
  '待分类',
  'uncategorized',
  0,
  'active',
  true,
  false,
  true,
  NOW()
)
ON CONFLICT ("slug")
DO UPDATE
SET
  "name" = EXCLUDED."name",
  "sort_order" = EXCLUDED."sort_order",
  "status" = EXCLUDED."status",
  "is_system" = EXCLUDED."is_system",
  "is_selectable" = EXCLUDED."is_selectable",
  "is_collapsed_by_default" = EXCLUDED."is_collapsed_by_default",
  "updated_at" = NOW();

INSERT INTO "prompt_categories" ("prompt_id", "category_id")
SELECT p.id, c.id
FROM "prompts" p
CROSS JOIN "categories" c
WHERE c.slug = 'uncategorized'
  AND NOT EXISTS (
    SELECT 1
    FROM "prompt_categories" pc
    WHERE pc.prompt_id = p.id
  )
ON CONFLICT ("prompt_id", "category_id") DO NOTHING;
