/**
 * Cards are encoded as a single integer 0..51 for speed: `rank * 4 + suit`.
 * Rank 0 = deuce ... 12 = ace. Suit 0 = clubs, 1 = diamonds, 2 = hearts, 3 = spades.
 * The Monte Carlo engine deals millions of these, so we keep them primitive and
 * convert to display strings only at the UI boundary.
 */
export type Card = number;

export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"] as const;
export const SUITS = ["c", "d", "h", "s"] as const;

export type RankChar = (typeof RANKS)[number];
export type SuitChar = (typeof SUITS)[number];

export const DECK_SIZE = 52;

export function makeCard(rank: number, suit: number): Card {
  return rank * 4 + suit;
}

export function rankOf(card: Card): number {
  return card >> 2;
}

export function suitOf(card: Card): number {
  return card & 3;
}

export function rankChar(card: Card): RankChar {
  return RANKS[rankOf(card)];
}

export function suitChar(card: Card): SuitChar {
  return SUITS[suitOf(card)];
}

/** "As", "Td", "7c" */
export function cardToString(card: Card): string {
  return rankChar(card) + suitChar(card);
}

export function cardsToString(cards: readonly Card[]): string {
  return cards.map(cardToString).join(" ");
}

export function parseCard(text: string): Card {
  const trimmed = text.trim();
  if (trimmed.length !== 2) throw new Error(`Bad card: "${text}"`);
  const rank = RANKS.indexOf(trimmed[0].toUpperCase() as RankChar);
  const suit = SUITS.indexOf(trimmed[1].toLowerCase() as SuitChar);
  if (rank < 0 || suit < 0) throw new Error(`Bad card: "${text}"`);
  return makeCard(rank, suit);
}

/** parseCards("As Kd 7c") or parseCards("AsKd7c") */
export function parseCards(text: string): Card[] {
  const compact = text.replace(/[\s,]/g, "");
  if (compact.length % 2 !== 0) throw new Error(`Bad card list: "${text}"`);
  const out: Card[] = [];
  for (let i = 0; i < compact.length; i += 2) out.push(parseCard(compact.slice(i, i + 2)));
  return out;
}

export function freshDeck(): Card[] {
  const deck: Card[] = new Array(DECK_SIZE);
  for (let i = 0; i < DECK_SIZE; i++) deck[i] = i;
  return deck;
}

/** Mulberry32 — small, fast, and seedable so hands and tests are reproducible. */
export type Rng = () => number;

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place Fisher-Yates. */
export function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

/**
 * A deck that deals off the end, so removing known cards (hero's hand, the board)
 * before sampling is cheap. Used by both the hand engine and the equity simulator.
 */
export class Deck {
  private cards: Card[];
  private next: number;

  constructor(rng: Rng, exclude: readonly Card[] = []) {
    const blocked = new Set(exclude);
    this.cards = [];
    for (let c = 0; c < DECK_SIZE; c++) if (!blocked.has(c)) this.cards.push(c);
    shuffle(this.cards, rng);
    this.next = 0;
  }

  get remaining(): number {
    return this.cards.length - this.next;
  }

  deal(): Card {
    if (this.next >= this.cards.length) throw new Error("Deck exhausted");
    return this.cards[this.next++];
  }

  dealMany(count: number): Card[] {
    const out: Card[] = new Array(count);
    for (let i = 0; i < count; i++) out[i] = this.deal();
    return out;
  }
}
