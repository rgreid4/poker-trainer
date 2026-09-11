import { type HandKey, allHandKeys, comboCount, isPair, isSuited, ranksOfKey } from "@/lib/ranges";

/**
 * TUNING FILE. A strength ordering for all 169 starting hands, used to build
 * "this player enters with 55% of hands" style ranges for the opponent model.
 *
 * The score is the Chen formula, which is a well-known hand-strength
 * approximation rather than solver output. It is plenty accurate for describing
 * how loose a recreational player is; the hero's own ranges are defined
 * explicitly in `preflopRanges.ts` instead of being derived from this.
 */
export function chenScore(key: HandKey): number {
  const [hi, lo] = ranksOfKey(key);

  const highCardValue = (rank: number): number => {
    switch (rank) {
      case 12:
        return 10; // ace
      case 11:
        return 8; // king
      case 10:
        return 7; // queen
      case 9:
        return 6; // jack
      default:
        return (rank + 2) / 2;
    }
  };

  if (isPair(key)) return Math.max(5, highCardValue(hi) * 2);

  let score = highCardValue(hi);
  if (isSuited(key)) score += 2;

  const gap = hi - lo - 1;
  if (gap === 1) score -= 1;
  else if (gap === 2) score -= 2;
  else if (gap === 3) score -= 4;
  else if (gap >= 4) score -= 5;

  // Straight bonus for connected low cards.
  if (gap <= 1 && hi < 10) score += 1;

  return Math.ceil(score * 2) / 2;
}

/** All 169 hands, strongest first. */
export const HAND_STRENGTH_ORDER: HandKey[] = allHandKeys().sort((a, b) => {
  const diff = chenScore(b) - chenScore(a);
  if (Math.abs(diff) > 1e-9) return diff;
  const [aHi, aLo] = ranksOfKey(a);
  const [bHi, bLo] = ranksOfKey(b);
  if (bHi !== aHi) return bHi - aHi;
  if (bLo !== aLo) return bLo - aLo;
  return Number(isSuited(b)) - Number(isSuited(a));
});

/** Position of a hand in the strength order, 0 = strongest. */
export const HAND_STRENGTH_INDEX: Map<HandKey, number> = new Map(
  HAND_STRENGTH_ORDER.map((key, index) => [key, index]),
);

/**
 * The strongest `percent` of all starting hands, as a weighted range. The last
 * hand included gets a partial weight so that "40% of hands" really is 40% of
 * combos rather than the nearest whole cell.
 */
export function topPercentRange(percent: number): Map<HandKey, number> {
  const target = Math.max(0, Math.min(1, percent)) * 1326;
  const range = new Map<HandKey, number>();
  let used = 0;
  for (const key of HAND_STRENGTH_ORDER) {
    if (used >= target) break;
    const combos = comboCount(key);
    const remaining = target - used;
    range.set(key, remaining >= combos ? 1 : Math.max(0.05, remaining / combos));
    used += combos;
  }
  return range;
}

/**
 * Cumulative share of all starting hands that are at least as strong as this
 * one. "AA" is about 0.005, a hand at 0.5 is a median holding. Lets the
 * opponent model ask "is this inside the 55% of hands this player enters with".
 */
export const HAND_PERCENTILE: Map<HandKey, number> = (() => {
  const map = new Map<HandKey, number>();
  let used = 0;
  for (const key of HAND_STRENGTH_ORDER) {
    used += comboCount(key);
    map.set(key, used / 1326);
  }
  return map;
})();

export function handPercentile(key: HandKey): number {
  return HAND_PERCENTILE.get(key) ?? 1;
}
