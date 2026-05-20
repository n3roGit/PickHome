"use client";

import { useTransition } from "react";
import { deleteUserAction } from "@/app/actions";

export function DeleteUserButton({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm(`Benutzer „${username}" wirklich löschen?`)) return;
        startTransition(() => deleteUserAction(userId));
      }}
      className="text-pn-score-low text-xs hover:underline mr-3 disabled:opacity-50"
    >
      {pending ? "Löscht…" : "Löschen"}
    </button>
  );
}
