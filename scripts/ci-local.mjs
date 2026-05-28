import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import net from "node:net";

const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/test-ci.db";
const DEV_PORT = Number(process.env.PORT ?? 3000);

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (err) => resolve(err.code === "EADDRINUSE"));
    server.once("listening", () => {
      server.close(() => resolve(false));
    });
    server.listen(port);
  });
}

function runStep(label, command, args, env) {
  console.log(`[pickhome] ${label}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function isWindowsPrismaEngineLock(output) {
  return (
    process.platform === "win32" &&
    output.includes("EPERM: operation not permitted, rename") &&
    output.includes("query_engine-windows.dll.node")
  );
}

function runPrismaGenerate(env) {
  const maxAttempts = process.platform === "win32" ? 3 : 1;
  let lastOutput = "";
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    console.log(
      attempt === 1
        ? "[pickhome] Generating Prisma client"
        : `[pickhome] Retrying Prisma generate (${attempt}/${maxAttempts})`,
    );
    const result = spawnSync("npx", ["prisma", "generate"], {
      stdio: "pipe",
      shell: true,
      env: { ...process.env, ...env },
      encoding: "utf8",
    });
    const stdout = result.stdout ?? "";
    const stderr = result.stderr ?? "";
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    lastOutput = `${stdout}\n${stderr}`;
    if (result.status === 0) {
      return;
    }
    if (attempt < maxAttempts) {
      spawnSync("ping", ["127.0.0.1", "-n", "3"], { shell: true, stdio: "ignore" });
    }
  }
  if (isWindowsPrismaEngineLock(lastOutput)) {
    console.warn(
      "[pickhome] Prisma generate hit a Windows file lock. Continuing with existing client; CI on GitHub will still run full generate+build.",
    );
    return;
  }
  process.exit(1);
}

async function main() {
  mkdirSync("data", { recursive: true });

  if (await isPortInUse(DEV_PORT)) {
    console.error(
      `[pickhome] Port ${DEV_PORT} is in use (likely "npm run dev"). Stop the dev server before running CI checks.`,
    );
    console.error(
      "[pickhome] On Windows a running dev server can block prisma generate during npm run build.",
    );
    process.exit(1);
  }

  const env = { DATABASE_URL };
  runPrismaGenerate(env);
  runStep("Running tests (matches GitHub Test workflow)", "npm", ["test"], env);
  // Avoid a second prisma generate here: Vitest may still hold the query engine on Windows.
  runStep("Running production build (matches GitHub Test workflow)", "npx", ["next", "build"], env);
  console.log("[pickhome] Local CI checks passed.");
}

main();
