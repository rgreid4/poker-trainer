import type { SizingTag } from "@/lib/types";

/**
 * TUNING FILE. Every number the strategy engine uses to turn equity, pot odds
 * and hand strength into a recommendation.
 *
 * These are exploitative heuristics for a loose, passive $0.25/$0.50 home game,
 * not solver output. The bias throughout is: value bet more and bigger, bluff
 * far less, and believe passive players when they suddenly get aggressive.
 */

/** How far below the best action a choice can score and still earn each grade. */
export const GRADE_GAPS = {
  /** Within this of the best play, it is just as good. */
  good: 0.08,
  acceptable: 0.22,
  mistake: 0.5,
};

/**
 * When two actions score within this much of each other, the trainer says the
 * spot is close instead of pretending one play is clearly right.
 */
export const CLOSE_SPOT_EPSILON = 0.08;

/** Monte Carlo sample counts. Full hands can afford more runouts than drills. */
export const EQUITY_ITERATIONS = {
  full: 3000,
  drill: 1200,
};

export const PREFLOP = {
  /** Effective stack in big blinds at or below which it is a shove-or-fold spot. */
  shortStackBB: 15,
  /** A raise this many big blinds or more narrows even a loose caller. */
  bigRaiseBB: 8,
  /** Chance a profile must have of folding to a 3-bet before bluff 3-bets are worth it. */
  minFoldToThreeBet: 0.4,
  /** Cheap speculative calls need the price to be this many big blinds or less. */
  maxSpeculativeCallBB: 1.5,
};

export const POSTFLOP = {
  /** Equity against the field that justifies betting for value. */
  valueBetEquity: 0.55,
  /** Equity that justifies a thinner value bet against players who call too much. */
  thinValueEquity: 0.42,
  /** Calling needs equity to beat the pot odds by this margin. */
  callMargin: 0.02,
  /**
   * Extra equity credited to a draw because these players pay you off when you
   * hit. Scaled up per opponent still in the pot.
   */
  impliedOddsBonus: 0.04,
  impliedOddsPerOpponent: 0.02,
  /** Calling stations pay off even more, so draws are worth a little extra. */
  impliedOddsVsStation: 0.03,
  /** A bet of this share of the pot or more counts as "big". */
  bigBetRatio: 0.7,
  /** A bet of this share of the pot or less counts as "small" — often weak. */
  smallBetRatio: 0.4,
  /** Three or more players in the pot is multiway: bluff less, value bet straighter. */
  multiwayPlayers: 3,
  /** Below this SPR, strong hands should just get it in. */
  commitSPR: 1.5,
};

/**
 * Preferred bet sizes, best first. The engine scores a raise or bet by how well
 * its size matches the plan, so the buttons themselves get graded.
 */
export const SIZING_PREFERENCE: Record<string, SizingTag[]> = {
  /** Big hands against people who call too much: charge the maximum. */
  valueVsStation: ["pot", "threequarter", "half"],
  /** Big hands against someone capable of folding. */
  valueVsThinking: ["threequarter", "pot", "half"],
  /** Thin value with a marginal made hand. */
  thinValue: ["half", "threequarter", "third"],
  /** Semi-bluffing a draw. */
  semiBluff: ["threequarter", "half", "pot"],
  /** Charging draws on a wet board. */
  protection: ["pot", "threequarter"],
  /** The rare bluff. */
  bluff: ["half", "threequarter"],
  /** Preflop opens and isolation raises: bigger is better here. */
  preflopOpen: ["open", "iso"],
  preflopThreeBet: ["threebet"],
};

/** How much a size that is not the preferred one costs an action, by rank. */
export const SIZING_FIT = [1, 0.94, 0.85];
export const SIZING_FIT_OTHER = 0.7;
/** An all-in that is not a committed spot is usually overkill. */
export const SIZING_FIT_OVERSHOVE = 0.45;
