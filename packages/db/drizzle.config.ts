import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/resolve-database-url.ts";

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
