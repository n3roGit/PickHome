import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import * as OTPAuth from "otpauth";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PENDING_TOTP_COOKIE = "ph_totp_pending";
const PENDING_MAX_AGE_SEC = 300;
const RECOVERY_CODE_COUNT = 10;
const TOTP_ISSUER = "PickHome";

function authSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret === "change-me-in-production") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set in production");
    }
    return "pickhome-dev-totp-secret";
  }
  return secret;
}

export function isTotpEnabled(user: { totpEnabledAt: Date | null }) {
  return user.totpEnabledAt != null;
}

export function generateTotpSecret() {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function buildTotp(user: { username: string; totpSecret: string }) {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: user.username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.totpSecret),
  });
}

export function verifyTotpCode(user: { username: string; totpSecret: string }, code: string) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const totp = buildTotp(user);
  const delta = totp.validate({ token: normalized, window: 1 });
  return delta != null;
}

export function getOtpAuthUri(user: { username: string; totpSecret: string }) {
  return buildTotp(user).toString();
}

function signPendingPayload(payload: string) {
  return createHmac("sha256", authSecret()).update(payload).digest("base64url");
}

export async function setPendingTotpLogin(userId: string) {
  const issuedAt = Date.now();
  const payload = `${userId}:${issuedAt}`;
  const token = `${payload}:${signPendingPayload(payload)}`;
  cookies().set(PENDING_TOTP_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_MAX_AGE_SEC,
  });
}

export function getPendingTotpUserId(): string | null {
  const raw = cookies().get(PENDING_TOTP_COOKIE)?.value;
  if (!raw) return null;
  const lastColon = raw.lastIndexOf(":");
  if (lastColon < 0) return null;
  const payload = raw.slice(0, lastColon);
  const sig = raw.slice(lastColon + 1);
  const expected = signPendingPayload(payload);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  const [userId, issuedAtStr] = payload.split(":");
  if (!userId || !issuedAtStr) return null;
  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > PENDING_MAX_AGE_SEC * 1000) {
    return null;
  }
  return userId;
}

export function clearPendingTotpLogin() {
  cookies().delete(PENDING_TOTP_COOKIE);
}

function randomRecoverySegment() {
  return randomBytes(3).toString("hex").slice(0, 4);
}

export function generateRecoveryCodesPlain() {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    const parts = [randomRecoverySegment(), randomRecoverySegment(), randomRecoverySegment()];
    return parts.join("-");
  });
}

export function normalizeRecoveryCode(code: string) {
  return code.trim().toLowerCase().replace(/\s+/g, "");
}

export async function hashRecoveryCodes(codes: string[]) {
  return Promise.all(codes.map((c) => hashPassword(normalizeRecoveryCode(c))));
}

export async function storeRecoveryCodes(userId: string, codes: string[]) {
  const hashes = await hashRecoveryCodes(codes);
  await prisma.userRecoveryCode.createMany({
    data: hashes.map((codeHash) => ({ userId, codeHash })),
  });
}

export async function replaceRecoveryCodes(userId: string, codes: string[]) {
  await prisma.userRecoveryCode.deleteMany({ where: { userId } });
  await storeRecoveryCodes(userId, codes);
}

export async function consumeRecoveryCode(userId: string, code: string) {
  const normalized = normalizeRecoveryCode(code);
  const rows = await prisma.userRecoveryCode.findMany({
    where: { userId, usedAt: null },
  });
  for (const row of rows) {
    if (await verifyPassword(normalized, row.codeHash)) {
      await prisma.userRecoveryCode.update({
        where: { id: row.id },
        data: { usedAt: new Date() },
      });
      return true;
    }
  }
  return false;
}

export async function verifyTotpOrRecovery(
  user: { id: string; username: string; totpSecret: string | null; totpEnabledAt: Date | null },
  code: string,
  options?: { allowRecovery?: boolean }
) {
  if (!user.totpSecret || !user.totpEnabledAt) return false;
  const trimmed = code.trim();
  if (options?.allowRecovery !== false && trimmed.includes("-")) {
    return consumeRecoveryCode(user.id, trimmed);
  }
  return verifyTotpCode(
    { username: user.username, totpSecret: user.totpSecret },
    trimmed
  );
}
