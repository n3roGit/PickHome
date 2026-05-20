"use client";

import { ScoreBadge } from "@/components/ScoreBadge";
import { useApartmentLiveScore } from "@/components/ApartmentScoreProvider";

export function ApartmentLiveScoreBadge() {
  const { liveScore } = useApartmentLiveScore();
  return (
    <ScoreBadge
      score={liveScore.score}
      displayScore={liveScore.displayScore}
      dealbreaker={liveScore.dealbreaker}
    />
  );
}
