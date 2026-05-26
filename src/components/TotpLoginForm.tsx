"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  cancelTotpLoginAction,
  verifyTotpLoginAction,
  type TotpLoginResult,
} from "@/app/totp-actions";

const errors: Record<string, string> = {
  invalid: "Code ungültig. Authenticator-App oder Wiederherstellungscode prüfen.",
  rate_limited: "Zu viele Versuche. Bitte später erneut versuchen.",
  totp_expired: "Zwei-Faktor-Anmeldung abgelaufen. Bitte erneut anmelden.",
};

export function TotpLoginForm({ initialError }: { initialError?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(initialError ? errors[initialError] ?? initialError : null);

  function handleResult(result: TotpLoginResult) {
    if (result.ok) {
      router.push(result.redirectTo);
      router.refresh();
      return;
    }
    if (result.error === "totp_expired") {
      router.push("/login?error=totp_expired");
      return;
    }
    setError(errors[result.error] ?? "Code ungültig.");
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
            handleResult(await verifyTotpLoginAction(formData));
          });
        }}
      >
        <label className="block">
          <span className="text-sm font-medium text-pn-text-secondary">Code</span>
          <input
            name="code"
            autoComplete="one-time-code"
            inputMode="text"
            autoFocus
            required
            disabled={pending}
            placeholder="123456 oder xxxx-xxxx-xxxx"
            className="mt-1 w-full border border-pn-border rounded-lg px-3 py-2 font-mono"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="w-full bg-pn-accent text-white font-semibold py-2.5 rounded-lg disabled:opacity-60"
        >
          {pending ? "Wird geprüft…" : "Bestätigen"}
        </button>
      </form>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await cancelTotpLoginAction();
            if (result.ok) router.push(result.redirectTo);
          })
        }
        className="mt-4 text-sm text-pn-text-secondary hover:underline disabled:opacity-60"
      >
        Abbrechen
      </button>
    </>
  );
}
