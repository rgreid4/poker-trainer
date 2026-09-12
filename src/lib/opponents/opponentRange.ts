import { handPercentile, topPercentRange } from "@/data/handRanking";
import { PROFILES } from "@/data/profileTendencies";
import {
  type ActionRead,
  MANIAC_READS,
  PASSIVE_READS,
  PREFLOP_LINE_WIDTH,
  TIGHT_READS,
} from "@/data/rangeWeights";
import { POSTFLOP } from "@/data/thresholds";
import { analyzeHand } from "../handAnalysis";
import type { ActionRecord, HandState, Street } from "../types";
import { type RangeCombo, type WeightedRange, handKey, rangeCombos } from "../ranges";
import type { OpponentProfile, ProfileId } from "./profiles";

export function profileOf(id: ProfileId): OpponentProfile | null {
  if (id === "hero") return null;
  return PROFILES[id] ?? null;
}

function readsFor(profile: OpponentProfile): Record<ActionRead, Record<string, number>> {
  switch (profile.id) {
    case "maniac":
      return MANIAC_READS;
    case "tight":
      return TIGHT_READS;
    default:
      return PASSIVE_READS;
  }
}

/**
 * The preflop range we credit an opponent with, based on their archetype and
 * the preflop line they actually took.
 */
export function preflopRangeFor(state: HandState, seat: number): WeightedRange {
  const player = state.players[seat];
  const profile = profileOf(player.profile);
  if (!profile) return topPercentRange(1);
  const t = profile.tendencies;

  const own = state.history.filter((a) => a.street === "preflop" && a.seat === seat);
  const raised = own.some((a) => a.type === "raise" || a.type === "bet");
  const raisesByOthers = state.history.filter(
    (a) => a.street === "preflop" && (a.type === "raise" || a.type === "bet") && a.seat !== seat,
  ).length;

  if (raised) {
    // A raise from a passive player is a much stronger statement than a raise
    // from the maniac, which falls out of their openRaise frequency.
    const width =
      raisesByOthers > 0
        ? t.threeBet * PREFLOP_LINE_WIDTH.threeBet
        : t.vpip * t.openRaise * PREFLOP_LINE_WIDTH.raise;
    return topPercentRange(Math.max(0.01, Math.min(1, width)));
  }

  const called = own.some((a) => a.type === "call");
  const facedRaise = raisesByOthers > 0;

  if (called && facedRaise) return topPercentRange(t.callRaise * PREFLOP_LINE_WIDTH.callRaise);
  if (called) return topPercentRange(t.vpip * PREFLOP_LINE_WIDTH.limp);

  // Checked in the big blind, or has not acted yet.
  return topPercentRange(t.vpip * PREFLOP_LINE_WIDTH.bigBlindCheck);
}

/** Classify one betting action into the read table's terms. */
function readOf(action: ActionRecord, potBefore: number): ActionRead {
  if (action.type === "raise") return "raised";
  if (action.type === "bet") {
    const ratio = potBefore > 0 ? action.amount / potBefore : 1;
    if (ratio <= POSTFLOP.smallBetRatio) return "smallBet";
    if (ratio >= POSTFLOP.bigBetRatio) return "bigBet";
    return "bet";
  }
  if (action.type === "call") return "called";
  return "passive";
}

/** The strongest statement this player has made on the current street. */
export function strongestRead(state: HandState, seat: number, street: Street): ActionRead {
  const order: ActionRead[] = ["passive", "called", "smallBet", "bet", "bigBet", "raised"];
  let best: ActionRead = "passive";
  for (const action of state.history) {
    if (action.seat !== seat || action.street !== street || action.type === "post") continue;
    const read = readOf(action, action.potBefore);
    if (order.indexOf(read) > order.indexOf(best)) best = read;
  }
  return best;
}

export interface OpponentRead {
  seat: number;
  profile: OpponentProfile;
  /** Their strongest action on the current street. */
  read: ActionRead;
  /** True when a passive player has suddenly shown real aggression. */
  aggressionIsCredible: boolean;
  range: RangeCombo[];
  /** Share of all starting hands this range represents. */
  width: number;
}

/**
 * Estimate what an opponent is holding: start from their profile's preflop
 * range for the line they took, then weight each combo by how consistent it is
 * with what they have done since, street by street.
 */
export function estimateOpponentRange(state: HandState, seat: number): RangeCombo[] {
  const player = state.players[seat];
  const profile = profileOf(player.profile);
  const blocked = [...state.board, ...state.players.filter((p) => p.isHero).flatMap((p) => p.hole)];

  const preflop = preflopRangeFor(state, seat);
  if (!profile || state.board.length === 0) return rangeCombos(preflop, blocked);

  const reads = readsFor(profile);
  const streets: Street[] = ["flop", "turn", "river"];
  const boardAt: Record<string, number> = { flop: 3, turn: 4, river: 5 };

  const combos = rangeCombos(preflop, blocked);
  const weighted: RangeCombo[] = [];

  for (const combo of combos) {
    let weight = combo.weight;
    for (const street of streets) {
      const cards = boardAt[street];
      if (state.board.length < cards) break;
      const acted = state.history.some(
        (a) => a.seat === seat && a.street === street && a.type !== "post",
      );
      if (!acted) continue;
      const read = strongestRead(state, seat, street);
      const tier = analyzeHand(combo.cards, state.board.slice(0, cards)).tier;
      weight *= reads[read][tier] ?? 1;
      if (weight <= 0.001) break;
    }
    if (weight > 0.001) weighted.push({ cards: combo.cards, weight });
  }

  // If the reads eliminated everything, fall back to the preflop range rather
  // than pretending to know more than we do.
  return weighted.length > 0 ? weighted : combos;
}

/** Everything the strategy engine needs to know about one live opponent. */
export function readOpponent(state: HandState, seat: number): OpponentRead | null {
  const profile = profileOf(state.players[seat].profile);
  if (!profile) return null;

  const street = state.street;
  const read = street === "preflop" ? preflopRead(state, seat) : strongestRead(state, seat, street);
  const range = estimateOpponentRange(state, seat);
  const totalWeight = range.reduce((sum, combo) => sum + combo.weight, 0);

  const passive = profile.id === "station" || profile.id === "limper";
  const aggressive = read === "raised" || read === "bigBet";
  const lateStreet = street === "turn" || street === "river";

  return {
    seat,
    profile,
    read,
    // A passive player raising, or firing big on a later street, is the tell
    // this trainer exists to teach.
    aggressionIsCredible: aggressive && (passive || (profile.id === "tight" && lateStreet)),
    range,
    width: totalWeight / 1326,
  };
}

function preflopRead(state: HandState, seat: number): ActionRead {
  const own = state.history.filter(
    (a) => a.street === "preflop" && a.seat === seat && a.type !== "post",
  );
  if (own.some((a) => a.type === "raise")) return "raised";
  if (own.some((a) => a.type === "bet")) return "bet";
  if (own.some((a) => a.type === "call")) return "called";
  return "passive";
}

/** Live opponents, with the hero excluded. */
export function readOpponents(state: HandState, heroSeat: number): OpponentRead[] {
  const reads: OpponentRead[] = [];
  for (const player of state.players) {
    if (player.seat === heroSeat || player.status === "folded") continue;
    const read = readOpponent(state, player.seat);
    if (read) reads.push(read);
  }
  return reads;
}

/** A short description of a range for the feedback panel. */
export function describeRangeWidth(width: number): string {
  const percent = Math.round(width * 100);
  const suffix = `about ${percent}% of hands`;
  if (percent >= 45) return `very wide, ${suffix}`;
  if (percent >= 25) return `wide, ${suffix}`;
  if (percent >= 12) return `moderate, ${suffix}`;
  if (percent >= 5) return `fairly tight, ${suffix}`;
  return `narrow and strong, ${suffix}`;
}

/** Hand key for the hero, handy for preflop range lookups. */
export function heroHandKey(state: HandState): string {
  const hero = state.players[state.config.heroSeat];
  return handKey(hero.hole[0], hero.hole[1]);
}

export function heroPercentile(state: HandState): number {
  return handPercentile(heroHandKey(state));
}
