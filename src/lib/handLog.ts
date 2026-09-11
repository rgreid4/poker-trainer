import { formatMoney, formatMoneyWithBB } from "./money";
import type { ActionRecord, HandState, Street } from "./types";

export const STREET_LABELS: Record<Street, string> = {
  preflop: "Preflop",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "Showdown",
  complete: "Result",
};

/** "Dave (CO) raises to $4 (8bb)" */
export function describeAction(state: HandState, action: ActionRecord): string {
  const player = state.players[action.seat];
  const who = `${player.name} (${state.positions[action.seat]})`;
  const bb = state.config.bigBlind;
  const allIn = action.allIn ? ", all in" : "";

  switch (action.type) {
    case "post":
      return `${who} posts ${formatMoney(action.amount)}`;
    case "fold":
      return `${who} folds`;
    case "check":
      return `${who} checks`;
    case "call":
      return `${who} calls ${formatMoneyWithBB(action.amount, bb)}${allIn}`;
    case "bet":
      return `${who} bets ${formatMoneyWithBB(action.to, bb)}${allIn}`;
    case "raise":
      return `${who} raises to ${formatMoneyWithBB(action.to, bb)}${allIn}`;
  }
}

/** Short form for the seat bubble: "raise $4". */
export function shortAction(action: ActionRecord): string {
  switch (action.type) {
    case "post":
      return "posts";
    case "fold":
      return "folds";
    case "check":
      return "checks";
    case "call":
      return `calls ${formatMoney(action.amount)}`;
    case "bet":
      return `bets ${formatMoney(action.to)}`;
    case "raise":
      return `raises ${formatMoney(action.to)}`;
  }
}

export interface StreetLog {
  street: Street;
  label: string;
  /** Board cards visible on that street, for the log header. */
  lines: string[];
}

/** The hand history grouped by street, ready to render. */
export function groupedHistory(state: HandState): StreetLog[] {
  const groups: StreetLog[] = [];
  for (const action of state.history) {
    // Blind posts are shown by the seat bubbles, not the log.
    if (action.type === "post") continue;
    let group = groups.find((g) => g.street === action.street);
    if (!group) {
      group = { street: action.street, label: STREET_LABELS[action.street], lines: [] };
      groups.push(group);
    }
    group.lines.push(describeAction(state, action));
  }
  return groups;
}

/** The most recent action by each seat on the current street. */
export function latestActionBySeat(state: HandState): Record<number, ActionRecord | undefined> {
  const latest: Record<number, ActionRecord | undefined> = {};
  for (const action of state.history) {
    if (action.street !== state.street) continue;
    if (action.type === "post") continue;
    latest[action.seat] = action;
  }
  return latest;
}
