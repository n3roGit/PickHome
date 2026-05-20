"use client";

import Link from "next/link";
import { useState } from "react";
import { logoutAction } from "@/app/actions";
import { Logo } from "./Logo";

export function Nav({
  userName,
  isAdmin,
}: {
  userName?: string;
  isAdmin?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const home = userName ? "/dashboard" : "/login";

  const linkClass =
    "block md:inline text-sm text-pn-text-secondary hover:text-pn-text-primary py-2 md:py-0";

  return (
    <nav className="bg-pn-bg-surface border-b border-pn-border relative z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <Link href={home} className="shrink-0" onClick={() => setMenuOpen(false)}>
          <Logo />
        </Link>

        {userName ? (
          <>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-pn-border text-pn-text-primary"
              aria-expanded={menuOpen}
              aria-controls="nav-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="sr-only">Menü</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5"
                aria-hidden
              >
                {menuOpen ? (
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>

            <div
              id="nav-menu"
              className={`${
                menuOpen ? "flex" : "hidden"
              } md:flex absolute md:static top-full left-0 right-0 md:top-auto flex-col md:flex-row md:items-center gap-0 md:gap-6 bg-pn-bg-surface border-b md:border-0 border-pn-border px-4 py-2 md:p-0 shadow-sm md:shadow-none`}
            >
              <Link href="/dashboard" className={linkClass} onClick={() => setMenuOpen(false)}>
                Projekte
              </Link>
              {isAdmin ? (
                <Link href="/admin" className={linkClass} onClick={() => setMenuOpen(false)}>
                  Verwaltung
                </Link>
              ) : null}
              <Link
                href="/account/settings"
                className={linkClass}
                onClick={() => setMenuOpen(false)}
              >
                Einstellungen
              </Link>
              <span className="text-sm text-pn-text-secondary py-2 md:py-0 truncate max-w-[12rem] md:max-w-none">
                {userName}
              </span>
              <form action={logoutAction} className="py-2 md:py-0">
                <button type="submit" className="text-sm text-pn-accent hover:underline">
                  Abmelden
                </button>
              </form>
            </div>
          </>
        ) : null}
      </div>
    </nav>
  );
}
