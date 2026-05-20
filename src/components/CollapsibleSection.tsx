"use client";

import { useState, type ReactNode } from "react";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`w-5 h-5 transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
  className = "",
}: {
  title: string;
  subtitle?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`bg-pn-bg-surface border border-pn-border rounded-xl p-5 mb-6 ${className}`}>
      <button
        type="button"
        className="w-full flex items-start justify-between gap-3 text-left group"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <h2 className="font-semibold min-w-0">{title}</h2>
        <span className="shrink-0 text-pn-text-tertiary group-hover:text-pn-text-secondary transition-colors">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div className="mt-4">
          {subtitle && <div className="text-sm text-pn-text-secondary mb-4">{subtitle}</div>}
          {children}
        </div>
      )}
    </section>
  );
}
