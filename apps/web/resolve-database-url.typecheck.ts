import { resolveDatabaseUrl } from "../../packages/db/src/resolve-database-url.ts";

const processEnv: NodeJS.ProcessEnv = process.env;

resolveDatabaseUrl(processEnv);

const defaultResolved: string = resolveDatabaseUrl();
void defaultResolved;
