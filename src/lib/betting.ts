import type { Cents } from "./money";
import { potSize } from "./pot";
import type { HandState, LegalAction, PlayerState, SizingTag } from "./types";

export function activePlayers(state: HandState): PlayerState[] {
  return state.players.filter((p) => p.status === "active");
}

/** Players who can still win the pot (not folded), including all-ins. */
export function livePlayers(state: HandState): PlayerState[] {
  return state.players.filter((p) => p.status !== "folded");
}

export function callCost(state: HandState, seat: number): Cents {
  const player = state.players[seat];
  return Math.max(0, Math.min(state.currentBet - player.committed, player.stack));
}

/** The largest total this player can commit on the street (their all-in). */
export function maxRaiseTo(player: PlayerState): Cents {
  return player.committed + player.stack;
}

/**
 * Minimum legal total for a bet or raise. A raise must increase the current bet
 * by at least the size of the last full raise (preflop that seed is the big
 * blind), which is what stops the endless min-raise-by-a-penny loop.
 */
export function minRaiseTo(state: HandState): Cents {
  return state.currentBet + state.lastRaiseSize;
}

/** Can this player legally make a raise larger than a forced all-in? */
export function canRaise(state: HandState, seat: number): boolean {
  const player = state.players[seat];
  if (player.status !== "active") return false;
  // Already acted, and the only action since was a short all-in.
  if (state.canReopen[seat] === false) return false;
  // Someone must still be able to call it.
  const othersCanAct = state.players.some(
    (p) => p.seat !== seat && p.status === "active" && p.stack > 0,
  );
  return othersCanAct && maxRaiseTo(player) > state.currentBet;
}

export function roundToChip(amount: Cents, chip: Cents): Cents {
  return Math.round(amount / chip) * chip;
}

/**
 * Every action the acting player may legally take, with 2-3 sensible raise
 * sizes for a loose home game. Amounts are rounded to the small blind so the
 * numbers look like real chips on a kitchen table.
 */
export function legalActions(state: HandState): LegalAction[] {
  const seat = state.actingSeat;
  if (seat === null) return [];
  const player = state.players[seat];
  if (player.status !== "active") return [];

  const actions: LegalAction[] = [];
  const toCall = callCost(state, seat);
  const facingBet = state.currentBet > player.committed;

  if (facingBet) {
    actions.push({ type: "fold", cost: 0, to: player.committed, allIn: false });
    actions.push({
      type: "call",
      cost: toCall,
      to: player.committed + toCall,
      allIn: toCall >= player.stack,
      sizing: "call",
    });
  } else {
    actions.push({ type: "check", cost: 0, to: player.committed, allIn: false });
  }

  const isRaise = state.currentBet > 0;
  const maxTo = maxRaiseTo(player);
  const mayRaise = canRaise(state, seat);

  if (mayRaise) {
    const minTo = Math.min(minRaiseTo(state), maxTo);
    const seen = new Set<number>();
    for (const { to, sizing } of suggestedRaiseTotals(state, seat)) {
      const clamped = Math.max(minTo, Math.min(to, maxTo));
      if (clamped >= maxTo) continue; // the all-in button covers this
      if (seen.has(clamped)) continue;
      seen.add(clamped);
      actions.push({
        type: isRaise ? "raise" : "bet",
        cost: clamped - player.committed,
        to: clamped,
        allIn: false,
        sizing,
      });
    }
    if (!seen.has(minTo) && minTo < maxTo && seen.size === 0) {
      actions.push({
        type: isRaise ? "raise" : "bet",
        cost: minTo - player.committed,
        to: minTo,
        allIn: false,
        sizing: "min",
      });
    }
  }

  if (mayRaise && player.stack > 0 && maxTo > state.currentBet) {
    actions.push({
      type: isRaise ? "raise" : "bet",
      cost: player.stack,
      to: maxTo,
      allIn: true,
      sizing: "allin",
    });
  }

  return actions;
}

/** Raise bounds for a slider or custom amount. Null when raising is illegal. */
export function raiseBounds(state: HandState, seat: number): { minTo: Cents; maxTo: Cents } | null {
  if (!canRaise(state, seat)) return null;
  const maxTo = maxRaiseTo(state.players[seat]);
  return { minTo: Math.min(minRaiseTo(state), maxTo), maxTo };
}

/** Number of players who just limped in preflop (called the big blind). */
export function limperCount(state: HandState): number {
  if (state.street !== "preflop") return 0;
  return state.history.filter(
    (a) => a.street === "preflop" && a.type === "call" && a.to === state.config.bigBlind,
  ).length;
}

/** Players who have put money in on this street after a bet (cold callers). */
export function callersThisStreet(state: HandState): number {
  return state.history.filter((a) => a.street === state.street && a.type === "call").length;
}

/**
 * The raise sizes offered as buttons. Preflop opens are deliberately large
 * (3x plus one big blind per limper) because a loose table calls anyway; the
 * strategy engine leans on the same numbers.
 */
export function suggestedRaiseTotals(
  state: HandState,
  seat: number,
): Array<{ to: Cents; sizing: SizingTag }> {
  const { bigBlind, smallBlind } = state.config;
  const player = state.players[seat];
  const pot = potSize(state);
  const toCall = Math.max(0, state.currentBet - player.committed);
  const potAfterCall = pot + toCall;
  const out: Array<{ to: Cents; sizing: SizingTag }> = [];

  const pushFraction = (fraction: number, sizing: SizingTag) => {
    const raw = state.currentBet + fraction * potAfterCall;
    out.push({ to: Math.max(roundToChip(raw, smallBlind), smallBlind), sizing });
  };

  if (state.street === "preflop") {
    const limpers = limperCount(state);
    if (state.currentBet <= bigBlind) {
      // Opening or isolating limpers.
      const base = 3 * bigBlind + limpers * bigBlind;
      out.push({ to: roundToChip(base, smallBlind), sizing: limpers > 0 ? "iso" : "open" });
      out.push({ to: roundToChip(base + bigBlind, smallBlind), sizing: limpers > 0 ? "iso" : "open" });
    } else {
      // 3-bet or better: 3x the last bet, plus one unit per cold caller.
      const callers = callersThisStreet(state);
      out.push({ to: roundToChip(state.currentBet * 3 + callers * state.currentBet, smallBlind), sizing: "threebet" });
      out.push({ to: roundToChip(state.currentBet * 4 + callers * state.currentBet, smallBlind), sizing: "threebet" });
    }
    return out;
  }

  pushFraction(0.5, "half");
  pushFraction(0.75, "threequarter");
  pushFraction(1, "pot");
  return out;
}

/** Describe a bet as a fraction of the pot it was made into. */
export function potFraction(amount: Cents, pot: Cents): number {
  if (pot <= 0) return 0;
  return amount / pot;
}
