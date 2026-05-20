import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true, role: true },
  });

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.username, 10);
    await prisma.userRecoveryCode.deleteMany({ where: { userId: user.id } });
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        totpSecret: null,
        totpEnabledAt: null,
      },
    });
    console.log(`${user.username} / ${user.username} (${user.role}, TOTP off)`);
  }

  console.log(`Updated ${users.length} user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
