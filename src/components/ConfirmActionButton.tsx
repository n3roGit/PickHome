"use client";

import { useTransition, type ReactNode } from "react";

export function ConfirmActionButton({
  confirmMessage,
  action,
  children,
  className,
  disabled,
  pendingLabel = "…",
  title,
}: {
  confirmMessage: string;
  action: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  pendingLabel?: string;
  title?: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      title={title}
      onClick={() => {
        if (!window.confirm(confirmMessage)) return;
        startTransition(() => void action());
      }}
      className={className}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
