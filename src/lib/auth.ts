import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const COOKIE = "ph_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30;
export const ROLE_ADMIN = "ADMIN";
export const ROLE_USER = "USER";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function authSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "change-me-in-production") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    return "pickhome-dev-session-secret";
  }
  return secret;
}

function secureCookie() {
  return process.env.NODE_ENV === "production";
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string, issuedAt = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt })).toString("base64url");
  return `${payload}.${signSessionPayload(payload)}`;
}

export function verifySessionToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = signSessionPayload(payload);
  try {
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      return null;
    }
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: unknown;
      issuedAt?: unknown;
    };
    if (typeof data.userId !== "string" || typeof data.issuedAt !== "number") return null;
    if (Date.now() - data.issuedAt > SESSION_MAX_AGE_SEC * 1000) return null;
    return data.userId;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const token = createSessionToken(userId);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookie(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE);
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
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
