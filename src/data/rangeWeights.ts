import type { HandTier } from "@/lib/handAnalysis";

/**
 * TUNING FILE. How to read a home-game opponent's hand from what they did.
 *
 * Each table maps a hand tier to how likely this line is, given the player's
 * archetype. The central fact these numbers encode: recreational players bet
 * and raise when they have something and check and call when they do not, so
 * their actions are far more informative than a thinking player's would be.
 */
export type ActionRead =
  /** Checked when they could have bet. */
  | "passive"
  /** Called a bet. */
  | "called"
  /** Made a small bet, a third of the pot or less. */
  | "smallBet"
  /** Made a normal bet. */
  | "bet"
  /** Made a big bet, three quarters of the pot or more. */
  | "bigBet"
  /** Raised someone else's bet, including a check-raise. */
  | "raised";

export type TierWeights = Record<HandTier, number>;

const ALL: TierWeights = {
  air: 1,
  weak_draw: 1,
  strong_draw: 1,
  weak_pair: 1,
  marginal_pair: 1,
  top_pair_weak_kicker: 1,
  top_pair_good_kicker: 1,
  overpair: 1,
  two_pair: 1,
  strong: 1,
  monster: 1,
};

/**
 * Weights for the passive archetypes (calling station, loose-passive limper).
 * A raise or a big bet from one of these players is close to a declaration.
 */
export const PASSIVE_READS: Record<ActionRead, TierWeights> = {
  passive: {
    ...ALL,
    // They would usually have bet a big hand, though not always.
    two_pair: 0.55,
    strong: 0.45,
    monster: 0.4,
    overpair: 0.6,
    top_pair_good_kicker: 0.7,
  },
  called: {
    ...ALL,
    // Calling is their default with anything at all, but a monster would
    // often have raised.
    air: 0.35,
    weak_draw: 0.9,
    two_pair: 0.5,
    strong: 0.4,
    monster: 0.35,
  },
  smallBet: {
    ...ALL,
    // The classic weak blocking bet or a draw taking a stab.
    air: 0.5,
    weak_draw: 1,
    strong_draw: 1,
    marginal_pair: 1,
    top_pair_weak_kicker: 0.9,
    two_pair: 0.45,
    strong: 0.4,
    monster: 0.45,
  },
  bet: {
    ...ALL,
    air: 0.15,
    weak_draw: 0.4,
    strong_draw: 0.7,
    weak_pair: 0.5,
    marginal_pair: 0.8,
  },
  bigBet: {
    ...ALL,
    // Passive players do not fire big without a hand.
    air: 0.05,
    weak_draw: 0.1,
    strong_draw: 0.35,
    weak_pair: 0.15,
    marginal_pair: 0.3,
    top_pair_weak_kicker: 0.7,
    top_pair_good_kicker: 1,
    overpair: 1,
  },
  raised: {
    ...ALL,
    // This is the read the whole app is built around.
    air: 0.03,
    weak_draw: 0.05,
    strong_draw: 0.25,
    weak_pair: 0.05,
    marginal_pair: 0.12,
    top_pair_weak_kicker: 0.35,
    top_pair_good_kicker: 0.75,
    overpair: 1,
    two_pair: 1,
    strong: 1,
    monster: 1,
  },
};

/** The maniac bets and raises with far too much, so his aggression says little. */
export const MANIAC_READS: Record<ActionRead, TierWeights> = {
  passive: { ...ALL, two_pair: 0.4, strong: 0.35, monster: 0.3 },
  called: { ...ALL, air: 0.5, monster: 0.5 },
  smallBet: { ...ALL, monster: 0.6 },
  bet: { ...ALL },
  bigBet: { ...ALL, air: 0.5, weak_draw: 0.6, weak_pair: 0.7 },
  raised: { ...ALL, air: 0.4, weak_draw: 0.5, weak_pair: 0.5, marginal_pair: 0.7 },
};

/** The tight player is closer to a normal opponent: credit their aggression. */
export const TIGHT_READS: Record<ActionRead, TierWeights> = {
  passive: { ...ALL, two_pair: 0.3, strong: 0.25, monster: 0.2 },
  called: { ...ALL, air: 0.15, weak_draw: 0.6, two_pair: 0.4, strong: 0.3, monster: 0.25 },
  smallBet: { ...ALL, air: 0.3, monster: 0.5 },
  bet: { ...ALL, air: 0.35, weak_draw: 0.5, weak_pair: 0.4 },
  bigBet: { ...ALL, air: 0.2, weak_draw: 0.25, weak_pair: 0.2, marginal_pair: 0.4 },
  raised: {
    ...ALL,
    air: 0.12,
    weak_draw: 0.15,
    strong_draw: 0.4,
    weak_pair: 0.12,
    marginal_pair: 0.25,
    top_pair_weak_kicker: 0.5,
  },
};

/**
 * Multiplier on how wide a profile's preflop range is when they take each
 * preflop line, as a share of the hands they play at all.
 */
export const PREFLOP_LINE_WIDTH = {
  /** Limped in: their whole playing range, minus the top they would have raised. */
  limp: 1,
  /** Open-raised: only the top slice of what they play. */
  raise: 0.7,
  /** Called a raise: the calling range from their tendencies. */
  callRaise: 1,
  /** 3-bet: the very top. */
  threeBet: 1,
  /** Checked the big blind: anything at all. */
  bigBlindCheck: 1,
};
