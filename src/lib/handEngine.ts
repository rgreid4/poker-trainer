import { type Card, type Rng, freshDeck, shuffle } from "./cards";
import { evaluate } from "./evaluator";
import { describeScore } from "./handRank";
import { callCost, livePlayers, minRaiseTo } from "./betting";
import type { Cents } from "./money";
import { awardPots, buildPots } from "./pot";
import { assignPositions, bigBlindSeat, postflopOrder, preflopOrder, smallBlindSeat } from "./table";
import type {
  ActionRecord,
  HandState,
  LegalAction,
  PlayerState,
  PotResult,
  ShowdownEntry,
  Street,
  TableConfig,
} from "./types";
import type { ProfileId } from "./opponents/profiles";

export interface CreateHandOptions {
  config: TableConfig;
  rng: Rng;
  /** Profile per seat. The entry for the hero seat is ignored. */
  profiles: ProfileId[];
  names?: string[];
  /** Per-seat starting stacks; defaults to config.startingStack for everyone. */
  stacks?: Cents[];
  /**
   * A pre-arranged deck, dealt from index 0 in the usual order (hole cards one
   * at a time starting left of the button, then flop, turn, river). Used by
   * tests and by the spot drills, which need specific cards.
   */
  deck?: Card[];
}

const NEXT_STREET: Record<string, Street> = {
  preflop: "flop",
  flop: "turn",
  turn: "river",
  river: "showdown",
};

const BOARD_CARDS: Record<string, number> = { flop: 3, turn: 1, river: 1 };

function clone(state: HandState): HandState {
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, hole: [...p.hole] })),
    board: [...state.board],
    needsToAct: [...state.needsToAct],
    canReopen: [...state.canReopen],
    history: [...state.history],
  };
}

export function actionOrder(state: HandState): number[] {
  const { tableSize, buttonSeat } = state.config;
  return state.street === "preflop"
    ? preflopOrder(tableSize, buttonSeat)
    : postflopOrder(tableSize, buttonSeat);
}

export function potNow(state: HandState): Cents {
  return state.players.reduce((sum, p) => sum + p.totalCommitted, 0);
}

function commit(state: HandState, seat: number, amount: Cents): Cents {
  const player = state.players[seat];
  const paid = Math.min(amount, player.stack);
  player.stack -= paid;
  player.committed += paid;
  player.totalCommitted += paid;
  if (player.stack === 0) player.status = "allin";
  return paid;
}

export function createHand(options: CreateHandOptions): HandState {
  const { config, rng, profiles } = options;
  const { tableSize, heroSeat, buttonSeat, smallBlind, bigBlind, startingStack } = config;
  const positions = assignPositions(tableSize, buttonSeat);

  const deck = options.deck ?? shuffle(freshDeck(), rng);
  let deckIndex = 0;

  const players: PlayerState[] = [];
  for (let seat = 0; seat < tableSize; seat++) {
    players.push({
      seat,
      name: options.names?.[seat] ?? (seat === heroSeat ? "You" : `Player ${seat + 1}`),
      isHero: seat === heroSeat,
      profile: profiles[seat],
      stack: options.stacks?.[seat] ?? startingStack,
      committed: 0,
      totalCommitted: 0,
      status: "active",
      hole: [],
      revealed: false,
    });
  }

  // Deal two cards each, one at a time starting left of the button.
  const dealOrder = postflopOrder(tableSize, buttonSeat);
  for (let round = 0; round < 2; round++) {
    for (const seat of dealOrder) players[seat].hole.push(deck[deckIndex++]);
  }

  const state: HandState = {
    config,
    positions,
    players,
    board: [],
    deck,
    deckIndex,
    street: "preflop",
    currentBet: 0,
    lastRaiseSize: bigBlind,
    actingSeat: null,
    needsToAct: players.map(() => true),
    canReopen: players.map(() => true),
    lastAggressor: null,
    potFromPreviousStreets: 0,
    history: [],
    result: null,
  };

  const sb = smallBlindSeat(positions);
  const bb = bigBlindSeat(positions);
  postBlind(state, sb, smallBlind);
  postBlind(state, bb, bigBlind);
  state.currentBet = Math.max(...players.map((p) => p.committed));
  state.lastRaiseSize = bigBlind;

  state.actingSeat = findNextActor(state, null);
  return state;
}

function postBlind(state: HandState, seat: number, amount: Cents): void {
  const potBefore = potNow(state);
  const paid = commit(state, seat, amount);
  state.history.push({
    seat,
    street: "preflop",
    type: "post",
    amount: paid,
    to: state.players[seat].committed,
    allIn: state.players[seat].status === "allin",
    potBefore,
  });
}

/** The next seat that still owes an action, or null when the street is done. */
function findNextActor(state: HandState, fromSeat: number | null): number | null {
  const order = actionOrder(state);
  const startIdx = fromSeat === null ? -1 : order.indexOf(fromSeat);
  for (let i = 1; i <= order.length; i++) {
    const seat = order[(startIdx + i + order.length) % order.length];
    const player = state.players[seat];
    if (player.status === "active" && state.needsToAct[seat]) return seat;
  }
  return null;
}

export interface ActionInput {
  type: LegalAction["type"];
  /** Required for bet and raise: the total street commitment being made. */
  to?: Cents;
}

export function applyAction(state: HandState, input: ActionInput): HandState {
  if (state.actingSeat === null) throw new Error("No player to act");
  const draft = clone(state);
  const seat = draft.actingSeat as number;
  const player = draft.players[seat];
  const potBefore = potNow(draft);

  let record: ActionRecord;

  switch (input.type) {
    case "fold": {
      player.status = "folded";
      record = {
        seat,
        street: draft.street,
        type: "fold",
        amount: 0,
        to: player.committed,
        allIn: false,
        potBefore,
      };
      break;
    }
    case "check": {
      if (draft.currentBet > player.committed) throw new Error("Cannot check facing a bet");
      record = {
        seat,
        street: draft.street,
        type: "check",
        amount: 0,
        to: player.committed,
        allIn: false,
        potBefore,
      };
      break;
    }
    case "call": {
      const cost = callCost(draft, seat);
      if (cost <= 0) throw new Error("Nothing to call");
      const paid = commit(draft, seat, cost);
      record = {
        seat,
        street: draft.street,
        type: "call",
        amount: paid,
        to: player.committed,
        allIn: player.status === "allin",
        potBefore,
      };
      break;
    }
    case "bet":
    case "raise": {
      const to = input.to;
      if (to === undefined) throw new Error("Bet or raise needs a target amount");
      const maxTo = player.committed + player.stack;
      if (to > maxTo) throw new Error("Cannot bet more than your stack");
      if (to <= draft.currentBet) throw new Error("Raise must exceed the current bet");
      const isAllIn = to === maxTo;
      if (!isAllIn && to < minRaiseTo(draft)) throw new Error("Raise below the minimum");

      const increment = to - draft.currentBet;
      const paid = commit(draft, seat, to - player.committed);

      // A short all-in worth less than a full raise does not reopen the betting
      // for players who have already acted.
      const isFullRaise = increment >= draft.lastRaiseSize;
      if (isFullRaise) draft.lastRaiseSize = increment;
      for (const other of draft.players) {
        if (other.seat === seat || other.status !== "active") continue;
        if (isFullRaise) {
          // A full raise puts everyone back in, with the right to raise again.
          draft.needsToAct[other.seat] = true;
          draft.canReopen[other.seat] = true;
        } else if (other.committed < to) {
          // A short all-in still has to be called, but it does not hand back
          // the right to raise to players who have already acted.
          draft.needsToAct[other.seat] = true;
        }
      }
      draft.currentBet = to;
      draft.lastAggressor = seat;

      record = {
        seat,
        street: draft.street,
        type: input.type,
        amount: paid,
        to: player.committed,
        allIn: player.status === "allin",
        potBefore,
      };
      break;
    }
    default:
      throw new Error(`Unknown action ${String(input.type)}`);
  }

  draft.needsToAct[seat] = false;
  draft.canReopen[seat] = false;
  draft.history.push(record);
  advance(draft);
  return draft;
}

/** Move the hand forward: next actor, next street, all-in runout, or showdown. */
function advance(state: HandState): void {
  if (livePlayers(state).length === 1) {
    finishHand(state, false);
    return;
  }

  const next = findNextActor(state, state.actingSeat);
  if (next !== null) {
    state.actingSeat = next;
    return;
  }

  closeStreet(state);

  // Betting is over for good once at most one player still has chips to wager.
  const canStillBet = state.players.filter((p) => p.status === "active" && p.stack > 0);
  const allInShowdown = canStillBet.length <= 1 && livePlayers(state).length > 1;

  if (allInShowdown) {
    finishHand(state, true);
    return;
  }

  const nextStreet = NEXT_STREET[state.street];
  if (nextStreet === "showdown") {
    finishHand(state, true);
    return;
  }

  dealStreet(state, nextStreet);
  for (const player of state.players) {
    state.needsToAct[player.seat] = player.status === "active";
    state.canReopen[player.seat] = player.status === "active";
  }
  state.actingSeat = findNextActor(state, null);
  if (state.actingSeat === null) advance(state);
}

function closeStreet(state: HandState): void {
  state.potFromPreviousStreets = potNow(state);
  for (const player of state.players) player.committed = 0;
  state.currentBet = 0;
  state.lastRaiseSize = state.config.bigBlind;
  state.lastAggressor = null;
  state.needsToAct = state.players.map(() => false);
  state.canReopen = state.players.map(() => false);
}

function dealStreet(state: HandState, street: Street): void {
  const count = BOARD_CARDS[street] ?? 0;
  for (let i = 0; i < count; i++) state.board.push(state.deck[state.deckIndex++]);
  state.street = street;
}

function finishHand(state: HandState, showdown: boolean): void {
  const live = livePlayers(state);
  const layers = buildPots(state.players);
  const scores: Record<number, number> = {};
  const showdownEntries: ShowdownEntry[] = [];

  if (showdown) {
    // Run the board out if everyone is all-in before the river.
    while (state.board.length < 5) {
      const street = NEXT_STREET[state.street];
      if (!street || street === "showdown") break;
      dealStreet(state, street);
    }
    for (const player of live) {
      const score = evaluate([...player.hole, ...state.board]);
      scores[player.seat] = score;
      player.revealed = true;
      showdownEntries.push({ seat: player.seat, score, description: describeScore(score) });
    }
  } else {
    scores[live[0].seat] = 1;
  }

  const oddChipOrder = postflopOrder(state.config.tableSize, state.config.buttonSeat);
  const pots: PotResult[] = awardPots(layers, scores, oddChipOrder);

  const net: Record<number, Cents> = {};
  for (const player of state.players) net[player.seat] = -player.totalCommitted;
  for (const pot of pots) {
    for (const [seatKey, amount] of Object.entries(pot.awarded)) {
      const seat = Number(seatKey);
      state.players[seat].stack += amount;
      net[seat] += amount;
    }
  }

  showdownEntries.sort((a, b) => b.score - a.score);

  const finalPot = layers.reduce((sum, layer) => sum + layer.amount, 0);
  // The chips have left the pot and are in front of the players again, so
  // clearing the commitments keeps the table total honest.
  for (const player of state.players) {
    player.committed = 0;
    player.totalCommitted = 0;
  }

  state.street = "complete";
  state.actingSeat = null;
  state.result = {
    pots,
    showdown: showdownEntries,
    net,
    wentToShowdown: showdown,
    finalPot,
    summary: buildSummary(state, pots, showdownEntries, showdown),
  };
}

function buildSummary(
  state: HandState,
  pots: PotResult[],
  showdown: ShowdownEntry[],
  wentToShowdown: boolean,
): string {
  if (pots.length === 0) return "No pot.";
  const winners = new Set<number>();
  for (const pot of pots) for (const seat of pot.winners) winners.add(seat);
  const names = [...winners].map((seat) => state.players[seat].name);

  if (!wentToShowdown) {
    return `${names.join(" and ")} won the pot, everyone else folded.`;
  }
  const parts = [...winners].map((seat) => {
    const entry = showdown.find((s) => s.seat === seat);
    return `${state.players[seat].name} wins with ${entry ? entry.description : "the best hand"}`;
  });
  return `Showdown: ${parts.join("; ")}.`;
}

/** Convenience for drills and tests: is the hero the one to act? */
export function heroToAct(state: HandState): boolean {
  return state.actingSeat !== null && state.players[state.actingSeat].isHero;
}

export function isHandOver(state: HandState): boolean {
  return state.street === "complete";
}

export function boardAfter(state: HandState): Card[] {
  return [...state.board];
}

/** Smallest stack in play between this seat and the players still in the hand. */
export function effectiveStack(state: HandState, seat: number): Cents {
  const player = state.players[seat];
  const others = state.players.filter((p) => p.seat !== seat && p.status !== "folded");
  if (others.length === 0) return player.stack;
  const largestOther = Math.max(...others.map((p) => p.stack + p.committed));
  return Math.min(player.stack + player.committed, largestOther);
}

/** Effective stack against one specific opponent. */
export function effectiveStackVs(state: HandState, seat: number, vsSeat: number): Cents {
  const a = state.players[seat];
  const b = state.players[vsSeat];
  return Math.min(a.stack + a.committed, b.stack + b.committed);
}
