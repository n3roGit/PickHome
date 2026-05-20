import { join } from "path";

/** Always isolate integration tests from dev/prod DATABASE_URL in the shell. */
const testDb = join(process.cwd(), "data", "test.db");
process.env.DATABASE_URL = `file:${testDb.replace(/\\/g, "/")}`;
