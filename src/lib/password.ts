export const MIN_PASSWORD_LENGTH = 4;

export type PasswordPairError = "password_too_short" | "password_mismatch";

export function readPasswordPair(
  formData: FormData,
  field = "password",
  confirmField = "passwordConfirm"
): { ok: true; password: string } | { ok: false; error: PasswordPairError } {
  const password = String(formData.get(field) ?? "");
  const confirm = String(formData.get(confirmField) ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "password_too_short" };
  }
  if (password !== confirm) {
    return { ok: false, error: "password_mismatch" };
  }
  return { ok: true, password };
}
