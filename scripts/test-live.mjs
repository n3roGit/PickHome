import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["vitest", "run", "tests/unit/geocode-bremen-live.test.ts"],
  {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, PICKHOME_LIVE_TESTS: "1" },
  },
);

process.exit(result.status ?? 1);
