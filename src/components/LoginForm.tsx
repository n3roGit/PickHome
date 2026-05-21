"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginAction, type LoginResult } from "@/app/totp-actions";

const errors: Record<string, string> = {
  invalid: "Benutzername oder Passwort falsch.",
  totp_expired: "Zwei-Faktor-Anmeldung abgelaufen. Bitte erneut anmelden.",
  rate_limited: "Zu viele Versuche. Bitte später erneut versuchen.",
};

export function LoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(initialError ? errors[initialError] ?? initialError : null);

  function handleResult(result: LoginResult) {
    if (result.ok) {
      router.push(result.redirectTo);
      router.refresh();
      return;
    }
    setError(errors[result.error] ?? "Anmeldung fehlgeschlagen.");
  }

  return (
  <>
      {error && (
        <p className="mb-4 text-sm text-pn-score-low bg-pn-score-low-bg px-3 py-2 rounded-lg">{error}</p>
      )}
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          startTransition(async () => {
            setError(null);
            handleResult(await loginAction(formData));
          });
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Benutzername</span>
          <input
            name="username"
            autoComplete="username"
            required
            disabled={pending}
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Passwort</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={pending}
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            name="remember"
            disabled={pending}
            className="rounded border-pn-border"
          />
          <span className="text-sm text-pn-text-secondary">Anmeldung speichern</span>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-pn-accent text-white font-semibold py-2.5 rounded-lg disabled:opacity-60"
        >
          {pending ? "Wird angemeldet…" : "Anmelden"}
        </button>
      </form>
    </>
  );
}
