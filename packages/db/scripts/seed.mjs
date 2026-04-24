import { databaseUrl } from "../src/client.ts";
import { seedDatabase } from "../src/seed.ts";

const reset = process.env.DB_SEED_RESET !== "false";

const summary = await seedDatabase(databaseUrl, { reset });
console.log(JSON.stringify({ databaseUrl, reset, summary }, null, 2));
