import { type Card, freshDeck, makeRng, parseCards } from "@/lib/cards";
import { createHand } from "@/lib/handEngine";
import type { ProfileId } from "@/lib/opponents/profiles";
import { postflopOrder } from "@/lib/table";
import type { HandState, TableConfig } from "@/lib/types";

export const BLINDS = { smallBlind: 25, bigBlind: 50 };

/**
 * Build a deck that deals exactly the cards we want. Cards go out one at a
 * time starting left of the button, two rounds, then the five board cards.
 */
export function stackedDeck(
  tableSize: number,
  buttonSeat: number,
  holes: Record<number, string>,
  board = "",
): Card[] {
  const deck: Card[] = new Array(52);
  const used = new Set<Card>();
  const order = postflopOrder(tableSize, buttonSeat);

  for (const [seatKey, text] of Object.entries(holes)) {
    const seat = Number(seatKey);
    const cards = parseCards(text);
    const slot = order.indexOf(seat);
    if (slot < 0) throw new Error(`Seat ${seat} is not at the table`);
    deck[slot] = cards[0];
    deck[tableSize + slot] = cards[1];
    cards.forEach((c) => used.add(c));
  }

  const boardCards = board ? parseCards(board) : [];
  boardCards.forEach((card, i) => {
    deck[tableSize * 2 + i] = card;
    used.add(card);
  });

  const spare = freshDeck().filter((card) => !used.has(card));
  let next = 0;
  for (let i = 0; i < deck.length; i++) {
    if (deck[i] === undefined) deck[i] = spare[next++];
  }
  return deck;
}

export interface TestHandOptions {
  tableSize?: number;
  buttonSeat?: number;
  heroSeat?: number;
  holes?: Record<number, string>;
  board?: string;
  stacks?: number[];
  profiles?: ProfileId[];
  seed?: number;
  startingStack?: number;
}

export function testHand(options: TestHandOptions = {}): HandState {
  const tableSize = options.tableSize ?? 6;
  const buttonSeat = options.buttonSeat ?? 0;
  const heroSeat = options.heroSeat ?? 1;
  const config: TableConfig = {
    tableSize,
    smallBlind: BLINDS.smallBlind,
    bigBlind: BLINDS.bigBlind,
    startingStack: options.startingStack ?? 2500,
    heroSeat,
    buttonSeat,
  };
  const profiles: ProfileId[] =
    options.profiles ??
    Array.from({ length: tableSize }, (_, seat) => (seat === heroSeat ? "hero" : "station"));

  return createHand({
    config,
    rng: makeRng(options.seed ?? 1),
    profiles,
    stacks: options.stacks,
    deck: options.holes || options.board
      ? stackedDeck(tableSize, buttonSeat, options.holes ?? {}, options.board ?? "")
      : undefined,
  });
}

/** Total chips on the table, which must never change during a hand. */
export function chipTotal(state: HandState): number {
  return state.players.reduce((sum, p) => sum + p.stack + p.totalCommitted, 0);
}
