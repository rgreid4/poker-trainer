import { type Card, rankOf, suitOf } from "./cards";

/**
 * Hand categories, ordered worst to best. The numeric value is the top field of
 * the packed score, so a plain `>` comparison decides any two hands.
 */
export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

/**
 * A hand's strength packed into one integer:
 *   category << 20 | r1 << 16 | r2 << 12 | r3 << 8 | r4 << 4 | r5
 * Ranks are ordered by relevance (pair rank first, then kickers), so comparing
 * two scores with `<`/`>` is a full comparison and equality means a genuine tie.
 */
export type HandScore = number;

const CATEGORY_SHIFT = 20;

function pack(category: HandCategory, r1 = 0, r2 = 0, r3 = 0, r4 = 0, r5 = 0): HandScore {
  return (category << CATEGORY_SHIFT) | (r1 << 16) | (r2 << 12) | (r3 << 8) | (r4 << 4) | r5;
}

export function categoryOf(score: HandScore): HandCategory {
  return score >>> CATEGORY_SHIFT;
}

/** The packed rank slots, most significant first. */
export function ranksOf(score: HandScore): number[] {
  return [(score >> 16) & 15, (score >> 12) & 15, (score >> 8) & 15, (score >> 4) & 15, score & 15];
}

const WHEEL_MASK = (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1;

/** Highest card rank of a 5-card straight inside `mask`, or -1 if there is none. */
function straightHigh(mask: number): number {
  const runs = mask & (mask >> 1) & (mask >> 2) & (mask >> 3) & (mask >> 4);
  if (runs !== 0) return 31 - Math.clz32(runs) + 4;
  if ((mask & WHEEL_MASK) === WHEEL_MASK) return 3; // 5-high wheel
  return -1;
}

/**
 * Evaluate the best five-card hand out of five, six or seven cards.
 * Works off rank/suit histograms rather than enumerating combinations, so a
 * single call is a few hundred nanoseconds — fast enough for Monte Carlo.
 */
export function evaluate(cards: readonly Card[]): HandScore {
  const rankCounts = new Int8Array(13);
  const suitCounts = new Int8Array(4);
  const suitRankMask = new Int16Array(4);
  let rankMask = 0;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const r = rankOf(card);
    const s = suitOf(card);
    rankCounts[r]++;
    suitCounts[s]++;
    suitRankMask[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  // Flush / straight flush
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      flushSuit = s;
      break;
    }
  }

  if (flushSuit >= 0) {
    const mask = suitRankMask[flushSuit];
    const sfHigh = straightHigh(mask);
    if (sfHigh >= 0) return pack(HandCategory.StraightFlush, sfHigh);
    const top: number[] = [];
    for (let r = 12; r >= 0 && top.length < 5; r--) if (mask & (1 << r)) top.push(r);
    return pack(HandCategory.Flush, top[0], top[1], top[2], top[3], top[4]);
  }

  // Group ranks by multiplicity, highest rank first within each group.
  const quads: number[] = [];
  const trips: number[] = [];
  const pairs: number[] = [];
  const singles: number[] = [];
  for (let r = 12; r >= 0; r--) {
    switch (rankCounts[r]) {
      case 4:
        quads.push(r);
        break;
      case 3:
        trips.push(r);
        break;
      case 2:
        pairs.push(r);
        break;
      case 1:
        singles.push(r);
        break;
    }
  }

  if (quads.length > 0) {
    const quad = quads[0];
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== quad && rankCounts[r] > 0) {
        kicker = r;
        break;
      }
    }
    return pack(HandCategory.FourOfAKind, quad, kicker);
  }

  if (trips.length > 0 && (trips.length > 1 || pairs.length > 0)) {
    const trip = trips[0];
    const pair = trips.length > 1 ? Math.max(trips[1], pairs.length ? pairs[0] : -1) : pairs[0];
    return pack(HandCategory.FullHouse, trip, pair);
  }

  const straight = straightHigh(rankMask);
  if (straight >= 0) return pack(HandCategory.Straight, straight);

  if (trips.length > 0) {
    const trip = trips[0];
    const kickers = singles.slice(0, 2);
    return pack(HandCategory.ThreeOfAKind, trip, kickers[0], kickers[1]);
  }

  if (pairs.length >= 2) {
    const [hi, lo] = pairs;
    let kicker = -1;
    for (let r = 12; r >= 0; r--) {
      if (r !== hi && r !== lo && rankCounts[r] > 0) {
        kicker = r;
        break;
      }
    }
    return pack(HandCategory.TwoPair, hi, lo, kicker);
  }

  if (pairs.length === 1) {
    const kickers = singles.slice(0, 3);
    return pack(HandCategory.Pair, pairs[0], kickers[0], kickers[1], kickers[2]);
  }

  const top = singles.slice(0, 5);
  return pack(HandCategory.HighCard, top[0], top[1], top[2], top[3], top[4]);
}

/** Convenience wrapper: hole cards plus board. */
export function evaluateHand(hole: readonly Card[], board: readonly Card[]): HandScore {
  return evaluate([...hole, ...board]);
}
