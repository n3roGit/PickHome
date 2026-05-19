import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ROLE_ADMIN } from "../src/lib/auth";

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash("admin", 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: { passwordHash: adminHash, role: ROLE_ADMIN, name: "Administrator" },
    create: {
      username: "admin",
      name: "Administrator",
      passwordHash: adminHash,
      role: ROLE_ADMIN,
    },
  });
  console.log("Admin bereit: admin / admin");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
