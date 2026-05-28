import {
  formatNoiseHitLine,
  noiseBandLowerDb,
  noiseHitsForCriterionName,
  type NoiseHit,
} from "@/lib/noise-uba";

export function buildNoiseHintsByCriterionId(
  criteria: { id: string; name: string }[],
  hits: NoiseHit[]
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of criteria) {
    const matched = noiseHitsForCriterionName(hits, c.name);
    if (matched.length === 0) continue;
    const top = matched.reduce((best, hit) => {
      const b = noiseBandLowerDb(hit.bandDb) ?? 0;
      const a = noiseBandLowerDb(best.bandDb) ?? 0;
      return b >= a ? hit : best;
    });
    out[c.id] = `UBA: ${formatNoiseHitLine(top)}`;
  }
  return out;
}
