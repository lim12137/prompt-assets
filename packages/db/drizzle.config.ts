import { defineConfig } from "drizzle-kit";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@127.0.0.1:5432/prompt_management";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
