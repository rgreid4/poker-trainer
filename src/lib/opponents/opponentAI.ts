import { PROFILES } from "@/data/profileTendencies";
import { handPercentile } from "@/data/handRanking";
import type { Rng } from "../cards";
import {
  callCost,
  legalActions,
  limperCount,
  maxRaiseTo,
  minRaiseTo,
  roundToChip,
} from "../betting";
import type { ActionInput } from "../handEngine";
import { potNow } from "../handEngine";
import { analyzeHand, tierRank } from "../handAnalysis";
import type { Cents } from "../money";
import { handKey } from "../ranges";
import type { HandState } from "../types";
import type { OpponentProfile, ProfileTendencies } from "./profiles";

/**
 * The house-game opponent model.
 *
 * Every decision runs through the tendencies in `data/profileTendencies.ts`, so
 * these players do the things that actually happen at a loose home table: they
 * limp in with junk, call raises far too wide, chase any draw at any price,
 * refuse to fold top pair, and only get aggressive when they genuinely have it.
 * Their bet sizing carries the same tells you can read at the table, which is
 * exactly what the trainer teaches you to exploit.
 */
export function chooseOpponentAction(state: HandState, rng: Rng): ActionInput {
  const seat = state.actingSeat;
  if (seat === null) throw new Error("No player to act");
  const player = state.players[seat];
  const profile = PROFILES[player.profile as Exclude<typeof player.profile, "hero">];
  if (!profile) throw new Error(`Seat ${seat} has no opponent profile`);

  const desired =
    state.street === "preflop"
      ? preflopAction(state, seat, profile, rng)
      : postflopAction(state, seat, profile, rng);

  return sanitize(state, seat, desired);
}

function preflopAction(
  state: HandState,
  seat: number,
  profile: OpponentProfile,
  rng: Rng,
): ActionInput {
  const t = profile.tendencies;
  const player = state.players[seat];
  const { bigBlind } = state.config;
  const key = handKey(player.hole[0], player.hole[1]);
  const percentile = handPercentile(key);
  const toCall = callCost(state, seat);
  const raises = state.history.filter(
    (a) => a.street === "preflop" && (a.type === "bet" || a.type === "raise"),
  ).length;
  const stackBB = player.stack / bigBlind;

  // Unopened or limped pot.
  if (raises === 0) {
    const limpers = limperCount(state);
    const playThreshold = t.vpip * (limpers > 0 ? 1.1 : 1);
    if (percentile > playThreshold) {
      return toCall > 0 ? { type: "fold" } : { type: "check" };
    }

    // Short stacks shove rather than open small.
    if (stackBB <= 10 && percentile < t.vpip * 0.4) {
      return { type: "raise", to: maxRaiseTo(player) };
    }

    const raiseChance = t.openRaise * (percentile < 0.1 ? 1.6 : 1);
    if (rng() < raiseChance) {
      const base = 3 * bigBlind + limpers * bigBlind;
      return { type: "raise", to: roundToChip(base * t.sizingBias, state.config.smallBlind) };
    }
    return toCall > 0 ? { type: "call" } : { type: "check" };
  }

  // Facing a raise (or a 3-bet).
  const facingThreeBet = raises >= 2;
  const threeBetThreshold = t.threeBet * (facingThreeBet ? 0.4 : 1);
  if (percentile <= threeBetThreshold) {
    if (stackBB <= 15) return { type: "raise", to: maxRaiseTo(player) };
    return { type: "raise", to: roundToChip(state.currentBet * 3, state.config.smallBlind) };
  }

  let callThreshold = facingThreeBet ? t.callRaise * (1 - t.foldToThreeBet) : t.callRaise;
  // Already invested in the blinds, so the price is better.
  if (player.committed > 0) callThreshold *= 1.25;
  // A very large raise narrows even a loose player a little.
  const priceInBB = toCall / bigBlind;
  if (priceInBB > 8) callThreshold *= 0.7;

  if (percentile <= callThreshold) return { type: "call" };
  return toCall > 0 ? { type: "fold" } : { type: "check" };
}

function postflopAction(
  state: HandState,
  seat: number,
  profile: OpponentProfile,
  rng: Rng,
): ActionInput {
  const t = profile.tendencies;
  const player = state.players[seat];
  const analysis = analyzeHand(player.hole, state.board);
  const tier = tierRank(analysis.tier);
  const pot = potNow(state);
  const toCall = callCost(state, seat);
  const facingBet = toCall > 0;

  const isMonster = tier >= tierRank("two_pair");
  const isStrong = tier >= tierRank("top_pair_good_kicker");
  const isMedium = tier >= tierRank("marginal_pair");
  const hasPair = tier >= tierRank("weak_pair");
  const hasDraw = analysis.draws.flushDraw || analysis.draws.openEnded || analysis.draws.gutshot;

  if (!facingBet) {
    // Nobody has bet: lead, block-bet, or check.
    if (isMonster && rng() < t.cbet + 0.15) {
      return bet(state, seat, t, strongSizing(rng, t), rng);
    }
    if (isStrong && rng() < t.cbet) {
      return bet(state, seat, t, 0.6, rng);
    }
    if (isMedium && rng() < t.blockBet) {
      return bet(state, seat, t, 0.28, rng);
    }
    if (analysis.draws.flushDraw || analysis.draws.openEnded) {
      if (rng() < t.bluffFreq * 2) return bet(state, seat, t, 0.5, rng);
    }
    if (rng() < t.bluffFreq) return bet(state, seat, t, 0.55, rng);
    return { type: "check" };
  }

  // Facing a bet. Price barely matters to these players, but a huge bet does
  // eventually shake a few of them off.
  const betSize = pot > 0 ? toCall / pot : 1;
  const sizePenalty = Math.max(0.45, 1 - betSize * 0.35);
  const allInPenalty = toCall >= player.stack ? 0.75 : 1;

  if (isMonster) {
    if (rng() < t.raiseStrong) return raise(state, seat, t, analysis.tier === "monster", rng);
    return { type: "call" };
  }

  if (tier >= tierRank("top_pair_weak_kicker")) {
    if (rng() < t.raiseStrong * 0.35) return raise(state, seat, t, false, rng);
    return rng() < t.foldTopPair * betSize ? { type: "fold" } : { type: "call" };
  }

  if (hasPair && rng() < t.callAnyPair * sizePenalty * allInPenalty) return { type: "call" };

  if (hasDraw) {
    const drawWeight = analysis.draws.flushDraw || analysis.draws.openEnded ? 1 : 0.65;
    if (rng() < t.callDraw * drawWeight * sizePenalty * allInPenalty) return { type: "call" };
    if (rng() < t.bluffFreq) return raise(state, seat, t, false, rng);
  }

  if (rng() < t.callOvercards * sizePenalty * allInPenalty * 0.6) return { type: "call" };
  if (rng() < t.bluffFreq * 0.5) return raise(state, seat, t, false, rng);

  return { type: "fold" };
}

/** Strong hands from passive players sometimes arrive as a giant overbet. */
function strongSizing(rng: Rng, t: ProfileTendencies): number {
  const roll = rng();
  if (roll < 0.15) return 1.3; // overbet tell
  if (roll < 0.35) return 0.45; // small bet hoping to be raised
  return 0.75 * (0.8 + t.sizingBias * 0.3);
}

function bet(
  state: HandState,
  seat: number,
  t: ProfileTendencies,
  fraction: number,
  rng: Rng,
): ActionInput {
  const pot = potNow(state);
  const jitter = 0.9 + rng() * 0.2;
  const raw = pot * fraction * t.sizingBias * jitter;
  const to = roundToChip(Math.max(raw, state.config.bigBlind), state.config.smallBlind);
  return { type: "bet", to };
}

/**
 * Raise sizing doubles as a tell: passive players often min-raise or massively
 * overbet with the nuts, which is precisely the pattern the trainer teaches.
 */
function raise(
  state: HandState,
  seat: number,
  t: ProfileTendencies,
  nutty: boolean,
  rng: Rng,
): ActionInput {
  const pot = potNow(state);
  const player = state.players[seat];
  const toCall = callCost(state, seat);
  const potAfterCall = pot + toCall;
  const roll = rng();

  let to: Cents;
  if (nutty && roll < 0.35) {
    to = minRaiseTo(state); // the classic min-raise-with-the-nuts tell
  } else if (nutty && roll > 0.85) {
    to = state.currentBet + Math.round(potAfterCall * 1.4); // overbet
  } else {
    to = state.currentBet + Math.round(potAfterCall * (0.7 + t.sizingBias * 0.25));
  }

  to = roundToChip(to, state.config.smallBlind);
  if (to >= maxRaiseTo(player) * 0.9) to = maxRaiseTo(player);
  return { type: "raise", to };
}

/** Force a desired action into something the betting rules actually allow. */
function sanitize(state: HandState, seat: number, desired: ActionInput): ActionInput {
  const legal = legalActions(state);
  const player = state.players[seat];
  const has = (type: ActionInput["type"]) => legal.some((a) => a.type === type);

  if (desired.type === "check" && !has("check")) {
    return has("call") ? { type: "call" } : { type: "fold" };
  }
  if (desired.type === "call" && !has("call")) {
    return has("check") ? { type: "check" } : { type: "fold" };
  }
  if (desired.type === "fold" && !has("fold")) {
    return { type: "check" };
  }
  if (desired.type === "bet" || desired.type === "raise") {
    const canAggress = legal.some((a) => a.type === "bet" || a.type === "raise");
    if (!canAggress) return has("call") ? { type: "call" } : has("check") ? { type: "check" } : { type: "fold" };
    const type = state.currentBet > 0 ? "raise" : "bet";
    const maxTo = maxRaiseTo(player);
    const minTo = Math.min(minRaiseTo(state), maxTo);
    const to = Math.max(minTo, Math.min(desired.to ?? minTo, maxTo));
    return { type, to };
  }
  return desired;
}

/** Deal out a profile mix for a table, weighted toward the loose players. */
export function pickProfile(rng: Rng, mix: Array<{ id: string; weight: number }>): string {
  const total = mix.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of mix) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return mix[mix.length - 1].id;
}
