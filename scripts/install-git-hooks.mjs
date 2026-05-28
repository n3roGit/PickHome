import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

if (process.env.CI || !existsSync(".git")) {
  process.exit(0);
}

const hooksPath = ".githooks";

try {
  const current = execSync("git config core.hooksPath", { encoding: "utf8" }).trim();
  if (current === hooksPath) {
    process.exit(0);
  }
  if (current) {
    console.warn(
      `[pickhome] Git hooksPath is already "${current}"; not changing it. Run "npm run ci" manually before push.`,
    );
    process.exit(0);
  }
} catch {
  // hooksPath not set yet
}

execSync(`git config core.hooksPath ${hooksPath}`, { stdio: "inherit" });
console.log(`[pickhome] Git pre-push hook enabled (${hooksPath}/pre-push → npm run ci)`);
