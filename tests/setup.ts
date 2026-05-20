import { getTestDatabaseUrl } from "./helpers/test-db-path";

/** Isolate integration tests from dev/prod DATABASE_URL and from other Vitest workers. */
process.env.DATABASE_URL = getTestDatabaseUrl();
