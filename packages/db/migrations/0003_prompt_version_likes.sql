ALTER TABLE "prompt_versions"
  ADD COLUMN "likes_count" integer DEFAULT 0 NOT NULL;

CREATE TABLE "prompt_version_likes" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_version_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "prompt_version_likes_prompt_version_id_user_id_key"
  ON "prompt_version_likes" USING btree ("prompt_version_id", "user_id");

ALTER TABLE "prompt_version_likes"
  ADD CONSTRAINT "prompt_version_likes_prompt_version_id_prompt_versions_id_fk"
  FOREIGN KEY ("prompt_version_id")
  REFERENCES "public"."prompt_versions"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;

ALTER TABLE "prompt_version_likes"
  ADD CONSTRAINT "prompt_version_likes_user_id_users_id_fk"
  FOREIGN KEY ("user_id")
  REFERENCES "public"."users"("id")
  ON DELETE CASCADE
  ON UPDATE NO ACTION;
