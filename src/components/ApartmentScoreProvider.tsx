"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type LiveApartmentScore = {
  score: number;
  displayScore: number;
  dealbreaker: boolean;
  rated: number;
  total: number;
};

const ApartmentScoreContext = createContext<{
  liveScore: LiveApartmentScore;
  setLiveScore: (score: LiveApartmentScore) => void;
} | null>(null);

export function ApartmentScoreProvider({
  initial,
  children,
}: {
  initial: LiveApartmentScore;
  children: ReactNode;
}) {
  const [liveScore, setLiveScore] = useState(initial);
  return (
    <ApartmentScoreContext.Provider value={{ liveScore, setLiveScore }}>
      {children}
    </ApartmentScoreContext.Provider>
  );
}

export function useApartmentLiveScore() {
  const ctx = useContext(ApartmentScoreContext);
  if (!ctx) {
    throw new Error("useApartmentLiveScore must be used within ApartmentScoreProvider");
  }
  return ctx;
}

export function useOptionalApartmentLiveScore() {
  return useContext(ApartmentScoreContext);
}
