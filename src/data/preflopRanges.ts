import type { Position } from "@/lib/table";

/**
 * TUNING FILE. The hero's preflop ranges for a loose $0.25/$0.50 home game.
 *
 * The guiding idea is to play TIGHTER than the table but MORE AGGRESSIVELY:
 * open-raise rather than limp, size up over limpers because they call anyway,
 * and favour hands that flop strong top pairs and big made hands, because pots
 * here are multiway and go to showdown. Small pairs and suited connectors are
 * playable when they are cheap and in position, not as bloated-pot hands.
 *
 * These are heuristics for this specific game, not GTO ranges. Edit freely.
 */
export type PositionGroup = "EP" | "MP" | "CO" | "BTN" | "SB" | "BB";

export function positionGroup(position: Position): PositionGroup {
  switch (position) {
    case "UTG":
    case "UTG+1":
    case "UTG+2":
      return "EP";
    case "MP":
    case "HJ":
      return "MP";
    case "CO":
      return "CO";
    case "BTN":
      return "BTN";
    case "SB":
      return "SB";
    case "BB":
      return "BB";
  }
}

/** Hands to open-raise when the pot is unopened and nobody has limped. */
export const OPEN_RAISE: Record<PositionGroup, string> = {
  EP: "77+, ATs+, KTs+, QJs, JTs, AJo+, KQo",
  MP: "66+, A9s+, KTs+, QTs+, JTs, T9s, ATo+, KJo+",
  CO: "44+, A5s+, K9s+, Q9s+, J9s+, T8s+, 98s, 87s, A9o+, KTo+, QJo",
  BTN: "22+, A2s+, K7s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, A7o+, K9o+, Q9o+, J9o+, T9o",
  SB: "33+, A4s+, K8s+, Q9s+, J9s+, T9s, 98s, A9o+, KTo+, QJo",
  BB: "44+, A7s+, K9s+, QTs+, JTs, ATo+, KJo+",
};

/**
 * Hands to raise over one or more limpers. Slightly tighter than an open but
 * played MUCH bigger: these players limp-call wide, so the iso-raise is a value
 * bet, not a steal. Junky suited hands are dropped because a raise here rarely
 * folds anyone out and multiway is likely.
 */
export const ISOLATE_LIMPERS: Record<PositionGroup, string> = {
  EP: "88+, ATs+, KQs, AJo+",
  MP: "77+, A9s+, KJs+, QJs, ATo+, KQo",
  CO: "55+, A8s+, KTs+, QTs+, JTs, T9s, ATo+, KJo+",
  BTN: "44+, A5s+, K9s+, Q9s+, J9s+, T9s, 98s, A9o+, KTo+, QJo",
  SB: "66+, A9s+, KTs+, QJs, JTs, ATo+, KQo",
  BB: "66+, A9s+, KTs+, QJs, JTs, AJo+, KQo",
};

/** Hands strong enough to 3-bet for value. Bluff 3-bets are deliberately rare. */
export const THREE_BET_VALUE: Record<PositionGroup, string> = {
  EP: "QQ+, AKs, AKo",
  MP: "JJ+, AQs+, AKo",
  CO: "TT+, AQs+, AKo",
  BTN: "99+, AJs+, KQs, AQo+",
  SB: "TT+, AQs+, AKo",
  BB: "TT+, AQs+, AKo",
};

/**
 * The small set of hands worth 3-betting as a semi-bluff, and only against
 * players who can fold. Against stations this list should stay tiny.
 */
export const THREE_BET_LIGHT: Record<PositionGroup, string> = {
  EP: "",
  MP: "",
  CO: "A5s, A4s",
  BTN: "A5s-A3s, KJs",
  SB: "A5s, A4s",
  BB: "A5s, A4s",
};

/** Hands to call a single raise with, when the price and position are right. */
export const CALL_VS_RAISE: Record<PositionGroup, string> = {
  EP: "88+, AQs+, AKo",
  MP: "77+, AJs+, KQs, AQo+",
  CO: "55+, ATs+, KJs+, QJs, JTs, AJo+, KQo",
  BTN: "22+, A9s+, KTs+, QTs+, JTs, T9s, 98s, ATo+, KJo+",
  SB: "77+, AJs+, KQs, AQo+",
  BB: "22+, A7s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo",
};

/**
 * Extra hands that become callable when the pot is already multiway and cheap:
 * implied-odds hands that want many callers and a low price.
 */
export const MULTIWAY_CALL_BONUS = "22+, 54s+, 65s+, 76s+, 87s+, 98s+, T9s, A2s-A5s";

/** Facing a raise and a 3-bet, or a 4-bet: value only. */
export const FOUR_BET_VALUE = "KK+, AKs";
export const CALL_VS_THREE_BET: Record<PositionGroup, string> = {
  EP: "JJ+, AKs, AKo",
  MP: "TT+, AQs+, AKo",
  CO: "99+, AJs+, AQo+",
  BTN: "88+, ATs+, AQo+",
  SB: "TT+, AQs+, AKo",
  BB: "99+, AJs+, AQo+",
};

/**
 * Short-stack shove ranges by remaining stack in big blinds. Home games run
 * 50bb deep, but stacks get short after a few lost pots.
 */
export const SHOVE_RANGES: Array<{ maxBB: number; range: string }> = [
  { maxBB: 6, range: "22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 87s, A2o+, K9o+, QTo+, JTo" },
  { maxBB: 10, range: "55+, A2s+, K9s+, QTs+, JTs, A7o+, KTo+, QJo" },
  { maxBB: 15, range: "77+, A9s+, KTs+, QJs, ATo+, KQo" },
];
