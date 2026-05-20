import { join } from "path";

/** One SQLite file per Vitest fork (process.pid is unique across parallel test files). */
export function getTestDbPath(): string {
  return join(process.cwd(), "data", `test-${process.pid}.db`);
}

export function getTestDatabaseUrl(): string {
  return `file:${getTestDbPath().replace(/\\/g, "/")}`;
}
