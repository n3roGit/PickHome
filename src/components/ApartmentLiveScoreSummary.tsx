"use client";

import { useApartmentLiveScore } from "@/components/ApartmentScoreProvider";
import { formatDateDe } from "@/lib/dates";

export function ApartmentLiveScoreSummary({
  userName,
  viewedAt,
}: {
  userName: string;
  viewedAt: Date | null;
}) {
  const { liveScore } = useApartmentLiveScore();
  return (
    <p className="text-sm text-pn-text-secondary mb-2">
      {liveScore.rated}/{liveScore.total} Kriterien bewertet · angemeldet als {userName}
      {viewedAt && ` · zuletzt besichtigt: ${formatDateDe(viewedAt)}`}
    </p>
  );
}
