import type { Cents } from "./money";
import type { HandState, PlayerState, PotResult } from "./types";

export interface PotLayer {
  amount: Cents;
  /** Seats still in the hand that can win this layer. */
  eligible: number[];
  isSidePot: boolean;
}

/**
 * Build the main pot and any side pots from each player's total contribution.
 *
 * Chips from folded players stay in the pot but win nothing, and a player can
 * only win the layers they actually paid into — that is what makes a short
 * all-in create a side pot the short stack cannot reach.
 */
export function buildPots(players: readonly PlayerState[]): PotLayer[] {
  const contributors = players.filter((p) => p.totalCommitted > 0);
  if (contributors.length === 0) return [];

  const levels = Array.from(new Set(contributors.map((p) => p.totalCommitted))).sort((a, b) => a - b);

  const layers: PotLayer[] = [];
  let previous = 0;
  for (const level of levels) {
    const slice = level - previous;
    let amount = 0;
    const eligible: number[] = [];
    for (const player of contributors) {
      if (player.totalCommitted >= level) {
        amount += slice;
        if (player.status !== "folded") eligible.push(player.seat);
      } else if (player.totalCommitted > previous) {
        amount += player.totalCommitted - previous;
      }
    }
    if (amount > 0) layers.push({ amount, eligible, isSidePot: layers.length > 0 });
    previous = level;
  }

  // A layer nobody is eligible for (everyone who paid in folded) is merged down
  // into the previous layer rather than left stranded.
  const merged: PotLayer[] = [];
  for (const layer of layers) {
    if (layer.eligible.length === 0 && merged.length > 0) {
      merged[merged.length - 1].amount += layer.amount;
      continue;
    }
    merged.push(layer);
  }
  return merged;
}

export function totalPot(players: readonly PlayerState[]): Cents {
  return players.reduce((sum, p) => sum + p.totalCommitted, 0);
}

/** Current pot: everything committed so far this hand, including this street. */
export function potSize(state: HandState): Cents {
  return totalPot(state.players);
}

/** What a caller would face: pot before their call, used for pot odds. */
export function potOdds(potBefore: Cents, callCost: Cents): number {
  if (callCost <= 0) return 0;
  return callCost / (potBefore + callCost);
}

/**
 * Award every pot layer. `scores` maps seat -> hand score (higher is better);
 * seats missing from it cannot win. Odd cents go to the first eligible seat in
 * `oddChipOrder` (by convention, the first seat left of the button).
 */
export function awardPots(
  layers: readonly PotLayer[],
  scores: Record<number, number>,
  oddChipOrder: readonly number[],
): PotResult[] {
  return layers.map((layer) => {
    const contenders = layer.eligible.filter((seat) => seat in scores);
    const best = contenders.reduce((max, seat) => Math.max(max, scores[seat]), -Infinity);
    const winners = contenders.filter((seat) => scores[seat] === best);

    const awarded: Record<number, Cents> = {};
    if (winners.length === 0) {
      return { amount: layer.amount, eligible: [...layer.eligible], winners, awarded, isSidePot: layer.isSidePot };
    }

    const share = Math.floor(layer.amount / winners.length);
    let remainder = layer.amount - share * winners.length;
    for (const seat of winners) awarded[seat] = share;

    for (const seat of oddChipOrder) {
      if (remainder <= 0) break;
      if (winners.includes(seat)) {
        awarded[seat] += 1;
        remainder -= 1;
      }
    }
    // Safety net if the odd-chip order did not cover every winner.
    let i = 0;
    while (remainder > 0) {
      awarded[winners[i % winners.length]] += 1;
      remainder -= 1;
      i += 1;
    }

    return {
      amount: layer.amount,
      eligible: [...layer.eligible],
      winners,
      awarded,
      isSidePot: layer.isSidePot,
    };
  });
}

/** Stack-to-pot ratio for the acting player — the key postflop commitment number. */
export function stackToPotRatio(effectiveStack: Cents, pot: Cents): number {
  if (pot <= 0) return Infinity;
  return effectiveStack / pot;
}
