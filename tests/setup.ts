import { join } from "path";

if (!process.env.DATABASE_URL) {
  const testDb = join(process.cwd(), "data", "test.db");
  process.env.DATABASE_URL = `file:${testDb.replace(/\\/g, "/")}`;
}
