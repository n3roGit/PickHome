import { prisma } from "@/lib/prisma";

export async function invalidateCommuteCacheForApartment(apartmentId: string): Promise<void> {
  await prisma.commuteCache.deleteMany({ where: { apartmentId } });
}

export async function invalidateCommuteCacheForUserAddress(userAddressId: string): Promise<void> {
  await prisma.commuteCache.deleteMany({ where: { userAddressId } });
}

export async function invalidateCommuteCacheForUser(userId: string): Promise<void> {
  await prisma.commuteCache.deleteMany({
    where: { userAddress: { userId } },
  });
}
