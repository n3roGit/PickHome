import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const COOKIE = "ph_session";
export const ROLE_ADMIN = "ADMIN";
export const ROLE_USER = "USER";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
  const token = Buffer.from(`${userId}:${Date.now()}`).toString("base64url");
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession() {
  cookies().delete(COOKIE);
}

export async function getSessionUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const userId = Buffer.from(token, "base64url").toString("utf8").split(":")[0];
    return prisma.user.findUnique({ where: { id: userId } });
  } catch {
    return null;
  }
}

export function isAdmin(user: { role: string }) {
  return user.role === ROLE_ADMIN;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!isAdmin(user)) redirect("/dashboard");
  return user;
}

export function redirectAfterLogin(user: { role: string }) {
  if (isAdmin(user)) redirect("/admin");
  redirect("/dashboard");
}
