"use client";

import { ApartmentLiveScoreBadge } from "@/components/ApartmentLiveScoreBadge";
import { useApartmentLiveScore } from "@/components/ApartmentScoreProvider";
import { formatDateDe } from "@/lib/dates";
import { useAppTimeZone } from "@/lib/use-app-timezone";

export function ApartmentLiveScoreSummary({
  userName,
  viewedAt,
}: {
  userName: string;
  viewedAt: Date | null;
}) {
  const appTimeZone = useAppTimeZone();
  const { liveScore } = useApartmentLiveScore();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 text-sm text-pn-text-secondary">
      <ApartmentLiveScoreBadge />
      <p className="m-0 min-w-0">
        {liveScore.rated}/{liveScore.total} Kriterien bewertet · {userName}
        {viewedAt && ` · besichtigt ${formatDateDe(viewedAt, appTimeZone)}`}
      </p>
    </div>
  );
}
