import { testDatabaseUrl } from "../src/client.ts";
import { seedDatabase } from "../src/seed.ts";

const reset = process.env.DB_SEED_RESET !== "false";

const summary = await seedDatabase(testDatabaseUrl, { reset });
console.log(JSON.stringify({ databaseUrl: testDatabaseUrl, reset, summary }, null, 2));
