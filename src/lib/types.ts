import type { Card } from "./cards";
import type { Cents } from "./money";
import type { Position } from "./table";
import type { ProfileId } from "./opponents/profiles";

export type Street = "preflop" | "flop" | "turn" | "river" | "showdown" | "complete";

export const STREETS: Street[] = ["preflop", "flop", "turn", "river"];

export type ActionType = "post" | "fold" | "check" | "call" | "bet" | "raise";

export type PlayerStatus = "active" | "folded" | "allin";

/** A sizing hint carried on suggested actions, used by the UI and the grader. */
export type SizingTag =
  | "min"
  | "call"
  | "third"
  | "half"
  | "threequarter"
  | "pot"
  | "overbet"
  | "open"
  | "iso"
  | "threebet"
  | "allin";

export interface ActionRecord {
  seat: number;
  street: Street;
  type: ActionType;
  /** Chips moved from the stack into the pot by this action. */
  amount: Cents;
  /** The player's total chips committed on this street after the action. */
  to: Cents;
  allIn: boolean;
  /** Pot size before the action, for reading back pot-relative sizings. */
  potBefore: Cents;
}

export interface LegalAction {
  type: Exclude<ActionType, "post">;
  /** Chips this action costs from the acting player's stack. */
  cost: Cents;
  /** Total street commitment after the action. */
  to: Cents;
  allIn: boolean;
  sizing?: SizingTag;
}

export interface PlayerState {
  seat: number;
  name: string;
  isHero: boolean;
  profile: ProfileId;
  stack: Cents;
  /** Committed on the current street. */
  committed: Cents;
  /** Committed across the whole hand. */
  totalCommitted: Cents;
  status: PlayerStatus;
  hole: Card[];
  /** Set at showdown so the UI can reveal hands. */
  revealed: boolean;
}

export interface TableConfig {
  tableSize: number;
  smallBlind: Cents;
  bigBlind: Cents;
  startingStack: Cents;
  heroSeat: number;
  buttonSeat: number;
}

export interface PotResult {
  /** Total chips in this pot. */
  amount: Cents;
  /** Seats eligible to win it. */
  eligible: number[];
  /** Seats that actually won it. */
  winners: number[];
  /** Chips awarded to each winner (may differ by one cent on odd splits). */
  awarded: Record<number, Cents>;
  isSidePot: boolean;
}

export interface ShowdownEntry {
  seat: number;
  score: number;
  description: string;
}

export interface HandResult {
  pots: PotResult[];
  showdown: ShowdownEntry[];
  /** Net cents won or lost this hand, keyed by seat. */
  net: Record<number, Cents>;
  wentToShowdown: boolean;
  /** Total chips in the pot when the hand ended. */
  finalPot: Cents;
  summary: string;
}

export interface HandState {
  config: TableConfig;
  positions: Position[];
  players: PlayerState[];
  board: Card[];
  deck: Card[];
  deckIndex: number;
  street: Street;
  /** Highest street commitment; what a player must match to call. */
  currentBet: Cents;
  /** Size of the last full raise, i.e. the minimum legal raise increment. */
  lastRaiseSize: Cents;
  /** Seat to act, or null when the street (or hand) is over. */
  actingSeat: number | null;
  /** Seats that still owe an action on this street. */
  needsToAct: boolean[];
  /**
   * Seats that may still raise. A player who has already acted loses the right
   * to raise again unless someone makes a full raise after them; a short all-in
   * that is less than a full raise does not give it back.
   */
  canReopen: boolean[];
  /** Last seat to bet or raise on the current street. */
  lastAggressor: number | null;
  /** Chips already collected from previous streets. */
  potFromPreviousStreets: Cents;
  history: ActionRecord[];
  result: HandResult | null;
}
