import { mkdir } from "fs/promises";
import { join } from "path";

const root = process.cwd();
const dataDir = process.env.PICKHOME_DATA_DIR
  ? join(root, process.env.PICKHOME_DATA_DIR)
  : join(root, "data");

await mkdir(join(dataDir, "uploads", "apartments"), { recursive: true });
