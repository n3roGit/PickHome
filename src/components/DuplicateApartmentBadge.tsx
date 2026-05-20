import Link from "next/link";
import type { DuplicateMatch } from "@/lib/apartment-duplicates";

export function DuplicateApartmentBadge({
  projectId,
  matches,
}: {
  projectId: string;
  matches: DuplicateMatch[];
}) {
  if (matches.length === 0) return null;

  const first = matches[0];
  const label =
    first.reason === "address"
      ? "Gleiche Adresse"
      : "Ähnlicher Titel";

  return (
    <p className="text-xs mt-1">
      <span className="font-medium text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
        Mögliche Dublette
      </span>{" "}
      <span className="text-pn-text-tertiary">({label})</span>{" "}
      <Link
        href={`/project/${projectId}/apartment/${first.otherId}`}
        className="text-pn-accent hover:underline"
      >
        {first.otherTitle}
      </Link>
      {matches.length > 1 && (
        <span className="text-pn-text-tertiary"> +{matches.length - 1}</span>
      )}
    </p>
  );
}
