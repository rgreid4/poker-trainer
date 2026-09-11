import { type Card, rankOf, suitOf } from "./cards";
import { HandCategory, categoryOf, evaluate } from "./evaluator";

/**
 * How strong a holding is in plain poker language. The opponent model and the
 * strategy engine both reason in these terms: "any pair calls", "only two pair
 * or better raises", and so on.
 */
export type HandTier =
  | "air"
  | "weak_draw"
  | "strong_draw"
  | "weak_pair"
  | "marginal_pair"
  | "top_pair_weak_kicker"
  | "top_pair_good_kicker"
  | "overpair"
  | "two_pair"
  | "strong"
  | "monster";

export const TIER_ORDER: HandTier[] = [
  "air",
  "weak_draw",
  "weak_pair",
  "strong_draw",
  "marginal_pair",
  "top_pair_weak_kicker",
  "top_pair_good_kicker",
  "overpair",
  "two_pair",
  "strong",
  "monster",
];

export function tierRank(tier: HandTier): number {
  return TIER_ORDER.indexOf(tier);
}

export type PairKind = "none" | "overpair" | "top" | "middle" | "bottom" | "underpair" | "pocket";

export interface Draws {
  flushDraw: boolean;
  backdoorFlush: boolean;
  openEnded: boolean;
  gutshot: boolean;
  /** Number of clean cards that improve the hand to something likely best. */
  outs: number;
}

export interface HandAnalysis {
  category: HandCategory;
  tier: HandTier;
  pairKind: PairKind;
  /** Rank of the kicker alongside a paired board card, or -1. */
  kicker: number;
  draws: Draws;
  /** True when the made hand beats anything a single pair can hold. */
  isStrongMade: boolean;
  /** Plain-English label, e.g. "top pair, weak kicker" or "flush draw". */
  label: string;
}

const HIGH_KICKER = 9; // jack or better counts as a good kicker

function straightMask(cards: readonly Card[]): number {
  let mask = 0;
  for (const card of cards) mask |= 1 << rankOf(card);
  return mask;
}

function hasStraight(mask: number): boolean {
  const runs = mask & (mask >> 1) & (mask >> 2) & (mask >> 3) & (mask >> 4);
  if (runs !== 0) return true;
  const wheel = (1 << 12) | (1 << 3) | (1 << 2) | (1 << 1) | 1;
  return (mask & wheel) === wheel;
}

function analyzeDraws(hole: readonly Card[], board: readonly Card[]): Draws {
  const all = [...hole, ...board];
  const suitCounts = new Int8Array(4);
  const holeSuits = new Int8Array(4);
  for (const card of all) suitCounts[suitOf(card)]++;
  for (const card of hole) holeSuits[suitOf(card)]++;

  let flushDraw = false;
  let backdoorFlush = false;
  for (let s = 0; s < 4; s++) {
    if (holeSuits[s] === 0) continue;
    if (suitCounts[s] === 4 && board.length < 5) flushDraw = true;
    if (suitCounts[s] === 3 && board.length === 3) backdoorFlush = true;
  }

  const mask = straightMask(all);
  let straightOuts = 0;
  if (!hasStraight(mask) && board.length < 5) {
    for (let r = 0; r < 13; r++) {
      if (mask & (1 << r)) continue;
      if (hasStraight(mask | (1 << r))) straightOuts++;
    }
  }
  const openEnded = straightOuts >= 2;
  const gutshot = straightOuts === 1;

  let outs = 0;
  if (flushDraw) outs += 9;
  if (openEnded) outs += flushDraw ? 6 : 8;
  else if (gutshot) outs += flushDraw ? 3 : 4;

  return { flushDraw, backdoorFlush, openEnded, gutshot, outs };
}

/**
 * Classify a holding against a board: what it has made, what it is drawing to,
 * and where that sits on the tier ladder the strategy engine uses.
 */
export function analyzeHand(hole: readonly Card[], board: readonly Card[]): HandAnalysis {
  const score = evaluate([...hole, ...board]);
  const category = categoryOf(score);
  const draws = analyzeDraws(hole, board);

  const boardRanks = board.map(rankOf).sort((a, b) => b - a);
  const holeRanks = hole.map(rankOf).sort((a, b) => b - a);
  const topBoard = boardRanks[0] ?? -1;

  let pairKind: PairKind = "none";
  let kicker = -1;

  if (category === HandCategory.Pair) {
    const isPocketPair = holeRanks[0] === holeRanks[1];
    if (isPocketPair) {
      pairKind = holeRanks[0] > topBoard ? "overpair" : "underpair";
    } else {
      const pairedRank = holeRanks.find((r) => boardRanks.includes(r)) ?? -1;
      if (pairedRank >= 0) {
        kicker = holeRanks.find((r) => r !== pairedRank) ?? -1;
        if (pairedRank === topBoard) pairKind = "top";
        else if (pairedRank === boardRanks[boardRanks.length - 1]) pairKind = "bottom";
        else pairKind = "middle";
      } else {
        pairKind = "pocket";
      }
    }
  }

  const tier = classifyTier(category, pairKind, kicker, draws, board.length);
  const isStrongMade = category >= HandCategory.TwoPair;

  return {
    category,
    tier,
    pairKind,
    kicker,
    draws,
    isStrongMade,
    label: describeTier(tier, draws),
  };
}

function classifyTier(
  category: HandCategory,
  pairKind: PairKind,
  kicker: number,
  draws: Draws,
  boardLength: number,
): HandTier {
  if (category >= HandCategory.Straight) return "monster";
  if (category === HandCategory.ThreeOfAKind) return "strong";
  if (category === HandCategory.TwoPair) return "two_pair";

  const strongDraw = draws.flushDraw || draws.openEnded;

  if (category === HandCategory.Pair) {
    switch (pairKind) {
      case "overpair":
        return "overpair";
      case "top":
        return kicker >= HIGH_KICKER ? "top_pair_good_kicker" : "top_pair_weak_kicker";
      case "middle":
      case "pocket":
        return "marginal_pair";
      case "underpair":
      case "bottom":
        return strongDraw ? "strong_draw" : "weak_pair";
      default:
        return "weak_pair";
    }
  }

  if (strongDraw) return "strong_draw";
  if (draws.gutshot || (draws.backdoorFlush && boardLength === 3)) return "weak_draw";
  return "air";
}

function describeTier(tier: HandTier, draws: Draws): string {
  switch (tier) {
    case "monster":
      return "a monster";
    case "strong":
      return "a set or better";
    case "two_pair":
      return "two pair";
    case "overpair":
      return "an overpair";
    case "top_pair_good_kicker":
      return "top pair, good kicker";
    case "top_pair_weak_kicker":
      return "top pair, weak kicker";
    case "marginal_pair":
      return "a middling pair";
    case "weak_pair":
      return "a weak pair";
    case "strong_draw":
      return draws.flushDraw && draws.openEnded
        ? "a monster draw"
        : draws.flushDraw
          ? "a flush draw"
          : "an open-ended straight draw";
    case "weak_draw":
      return draws.gutshot ? "a gutshot" : "a backdoor draw";
    default:
      return "no pair and no draw";
  }
}

/** Wet boards (connected, suited, high) call for bigger bets and more caution. */
export function boardTexture(board: readonly Card[]): {
  paired: boolean;
  suitedness: number;
  connectedness: number;
  wetness: number;
  highCard: number;
} {
  if (board.length === 0) {
    return { paired: false, suitedness: 0, connectedness: 0, wetness: 0, highCard: -1 };
  }
  const ranks = board.map(rankOf).sort((a, b) => b - a);
  const suitCounts = new Int8Array(4);
  for (const card of board) suitCounts[suitOf(card)]++;

  const rankCounts = new Map<number, number>();
  for (const r of ranks) rankCounts.set(r, (rankCounts.get(r) ?? 0) + 1);
  const paired = [...rankCounts.values()].some((c) => c >= 2);

  const maxSuit = Math.max(...suitCounts);
  const suitedness = (maxSuit - 1) / Math.max(1, board.length - 1);

  let connectedness = 0;
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  for (let i = 0; i < unique.length - 1; i++) {
    const gap = unique[i] - unique[i + 1];
    if (gap <= 2) connectedness += gap === 1 ? 0.5 : 0.3;
  }
  connectedness = Math.min(1, connectedness);

  const wetness = Math.min(1, suitedness * 0.5 + connectedness * 0.5);
  return { paired, suitedness, connectedness, wetness, highCard: ranks[0] };
}
