import Link from "next/link";
import { logoutAction } from "@/app/actions";
import { Logo } from "./Logo";

export function Nav({
  userName,
  isAdmin,
}: {
  userName?: string;
  isAdmin?: boolean;
}) {
  return (
    <nav className="bg-pn-bg-surface border-b border-pn-border">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href={isAdmin ? "/admin" : userName ? "/dashboard" : "/login"}>
          <Logo />
        </Link>
        <div className="flex items-center gap-6">
          {userName ? (
            <>
              {isAdmin ? (
                <Link href="/admin" className="text-sm text-pn-text-secondary hover:text-pn-text-primary">
                  Verwaltung
                </Link>
              ) : (
                <Link href="/dashboard" className="text-sm text-pn-text-secondary hover:text-pn-text-primary">
                  Projekte
                </Link>
              )}
              <span className="text-sm text-pn-text-secondary">{userName}</span>
              <form action={logoutAction}>
                <button type="submit" className="text-sm text-pn-accent hover:underline">
                  Abmelden
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
