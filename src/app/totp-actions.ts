"use server";

import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  redirectAfterLogin,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  clearPendingTotpLogin,
  generateRecoveryCodesPlain,
  generateTotpSecret,
  getOtpAuthUri,
  getPendingTotpUserId,
  isTotpEnabled,
  replaceRecoveryCodes,
  setPendingTotpLogin,
  verifyTotpCode,
  verifyTotpOrRecovery,
} from "@/lib/totp";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";

const LOGIN_LIMIT = 10;
const TOTP_LIMIT = 10;
const AUTH_WINDOW_MS = 15 * 60 * 1000;

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const loginKey = `login:${username || "unknown"}`;
  if (!checkRateLimit(loginKey, LOGIN_LIMIT, AUTH_WINDOW_MS)) {
    redirect("/login?error=rate_limited");
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }
  resetRateLimit(loginKey);
  if (isTotpEnabled(user)) {
    await destroySession();
    await setPendingTotpLogin(user.id);
    redirect("/login/totp");
  }
  await createSession(user.id);
  redirectAfterLogin(user);
}

export async function verifyTotpLoginAction(formData: FormData) {
  const userId = await getPendingTotpUserId();
  if (!userId) redirect("/login?error=totp_expired");
  const totpKey = `totp:${userId}`;
  if (!checkRateLimit(totpKey, TOTP_LIMIT, AUTH_WINDOW_MS)) {
    redirect("/login/totp?error=rate_limited");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !isTotpEnabled(user) || !user.totpSecret) {
    await clearPendingTotpLogin();
    redirect("/login?error=invalid");
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!(await verifyTotpOrRecovery(user, code))) {
    redirect("/login/totp?error=invalid");
  }

  await clearPendingTotpLogin();
  resetRateLimit(totpKey);
  await createSession(user.id);
  redirectAfterLogin(user);
}

export async function cancelTotpLoginAction() {
  await clearPendingTotpLogin();
  redirect("/login");
}

export async function beginTotpSetupAction() {
  const user = await requireUser();
  if (isTotpEnabled(user)) {
    redirect("/account/security?error=already_enabled");
  }

  const totpSecret = generateTotpSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret, totpEnabledAt: null },
  });

  revalidatePath("/account/security");
  redirect("/account/security?step=confirm");
}

export async function confirmTotpSetupAction(formData: FormData) {
  const user = await requireUser();
  if (!user.totpSecret || isTotpEnabled(user)) {
    redirect("/account/security");
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!verifyTotpCode({ username: user.username, totpSecret: user.totpSecret }, code)) {
    redirect("/account/security?step=confirm&error=invalid_code");
  }

  const recoveryCodes = generateRecoveryCodesPlain();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabledAt: new Date() },
  });
  await replaceRecoveryCodes(user.id, recoveryCodes);

  revalidatePath("/account/security");
  redirect(`/account/security?step=recovery&codes=${encodeURIComponent(recoveryCodes.join(","))}`);
}

export async function cancelTotpSetupAction() {
  const user = await requireUser();
  if (!isTotpEnabled(user)) {
    await prisma.user.update({
      where: { id: user.id },
      data: { totpSecret: null, totpEnabledAt: null },
    });
    await prisma.userRecoveryCode.deleteMany({ where: { userId: user.id } });
  }
  revalidatePath("/account/security");
  redirect("/account/security");
}

export async function disableTotpAction(formData: FormData) {
  const user = await requireUser();
  if (!isTotpEnabled(user) || !user.totpSecret) {
    redirect("/account/security");
  }

  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!(await verifyPassword(password, user.passwordHash))) {
    redirect("/account/security?error=bad_password");
  }
  if (!verifyTotpCode({ username: user.username, totpSecret: user.totpSecret }, code)) {
    redirect("/account/security?error=bad_code");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: null, totpEnabledAt: null },
  });
  await prisma.userRecoveryCode.deleteMany({ where: { userId: user.id } });

  revalidatePath("/account/security");
  redirect("/account/security?disabled=1");
}

export async function regenerateRecoveryCodesAction(formData: FormData) {
  const user = await requireUser();
  if (!isTotpEnabled(user) || !user.totpSecret) {
    redirect("/account/security");
  }

  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!(await verifyPassword(password, user.passwordHash))) {
    redirect("/account/security?error=bad_password");
  }
  if (!verifyTotpCode({ username: user.username, totpSecret: user.totpSecret }, code)) {
    redirect("/account/security?error=bad_code");
  }

  const recoveryCodes = generateRecoveryCodesPlain();
  await replaceRecoveryCodes(user.id, recoveryCodes);

  revalidatePath("/account/security");
  redirect(`/account/security?step=recovery&codes=${encodeURIComponent(recoveryCodes.join(","))}`);
}

export async function getTotpQrDataUrl(user: { username: string; totpSecret: string }) {
  const uri = getOtpAuthUri(user);
  return QRCode.toDataURL(uri);
}
