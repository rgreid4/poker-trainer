import { type Card, type Rng, DECK_SIZE } from "./cards";
import { evaluate } from "./evaluator";
import { type RangeCombo, type WeightedRange, rangeCombos } from "./ranges";

export interface EquityOptions {
  hero: readonly Card[];
  board: readonly Card[];
  /** One weighted range per opponent still in the hand. */
  opponents: readonly WeightedRange[];
  iterations?: number;
  rng: Rng;
}

export interface EquityResult {
  /** Share of the pot the hero expects to win, ties counted fractionally. */
  equity: number;
  win: number;
  tie: number;
  lose: number;
  samples: number;
  /** Hero equity against each opponent range one-on-one, same order as input. */
  perOpponent: number[];
}

interface PreparedRange {
  combos: RangeCombo[];
  cumulative: Float64Array;
  total: number;
}

function prepare(range: WeightedRange, blocked: readonly Card[]): PreparedRange {
  const combos = rangeCombos(range, blocked);
  const cumulative = new Float64Array(combos.length);
  let total = 0;
  for (let i = 0; i < combos.length; i++) {
    total += combos[i].weight;
    cumulative[i] = total;
  }
  return { combos, cumulative, total };
}

function sampleCombo(prepared: PreparedRange, rng: Rng): [Card, Card] | null {
  if (prepared.total <= 0) return null;
  const target = rng() * prepared.total;
  // Binary search over the cumulative weights.
  let lo = 0;
  let hi = prepared.cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (prepared.cumulative[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return prepared.combos[lo]?.cards ?? null;
}

export const DEFAULT_ITERATIONS = 3000;

/**
 * Monte Carlo equity for the hero against one or more opponent ranges.
 *
 * Each iteration samples a concrete hand for every opponent from their range
 * (rejecting combos that clash with cards already dealt), runs the board out,
 * and scores every hand. A few thousand iterations puts the estimate within
 * roughly a point of the true number, which is far finer than the decisions
 * being graded need.
 */
export function estimateEquity(options: EquityOptions): EquityResult {
  const { hero, board, opponents, rng } = options;
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;

  const known: Card[] = [...hero, ...board];
  const prepared = opponents.map((range) => prepare(range, known));
  const oppCount = prepared.length;

  const used = new Uint8Array(DECK_SIZE);
  const oppCards: Card[] = new Array(oppCount * 2);
  const fullBoard: Card[] = new Array(5);
  const heroCards: Card[] = new Array(7);

  let win = 0;
  let tie = 0;
  let lose = 0;
  let samples = 0;
  const perWin = new Float64Array(oppCount);
  const perSamples = new Float64Array(oppCount);

  const boardToDeal = 5 - board.length;

  for (let iter = 0; iter < iterations; iter++) {
    used.fill(0);
    for (const card of known) used[card] = 1;

    let ok = true;
    for (let o = 0; o < oppCount && ok; o++) {
      let placed = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const combo = sampleCombo(prepared[o], rng);
        if (!combo) break;
        if (used[combo[0]] || used[combo[1]]) continue;
        used[combo[0]] = 1;
        used[combo[1]] = 1;
        oppCards[o * 2] = combo[0];
        oppCards[o * 2 + 1] = combo[1];
        placed = true;
        break;
      }
      if (!placed) ok = false;
    }
    if (!ok) continue;

    for (let i = 0; i < board.length; i++) fullBoard[i] = board[i];
    for (let i = 0; i < boardToDeal; i++) {
      let card = 0;
      do {
        card = (rng() * DECK_SIZE) | 0;
      } while (used[card]);
      used[card] = 1;
      fullBoard[board.length + i] = card;
    }

    heroCards[0] = hero[0];
    heroCards[1] = hero[1];
    for (let i = 0; i < 5; i++) heroCards[2 + i] = fullBoard[i];
    const heroScore = evaluate(heroCards);

    let best = heroScore;
    let tiedWith = 0;
    let beaten = false;

    for (let o = 0; o < oppCount; o++) {
      const cards = [oppCards[o * 2], oppCards[o * 2 + 1], ...fullBoard];
      const score = evaluate(cards);

      perSamples[o] += 1;
      if (heroScore > score) perWin[o] += 1;
      else if (heroScore === score) perWin[o] += 0.5;

      if (score > best) {
        best = score;
        beaten = true;
        tiedWith = 0;
      } else if (score === best && score === heroScore) {
        tiedWith += 1;
      }
    }

    samples += 1;
    if (beaten) lose += 1;
    else if (tiedWith > 0) tie += 1 / (tiedWith + 1);
    else win += 1;
  }

  const denom = samples || 1;
  return {
    equity: (win + tie) / denom,
    win: win / denom,
    tie: tie / denom,
    lose: lose / denom,
    samples,
    perOpponent: Array.from({ length: oppCount }, (_, o) =>
      perSamples[o] > 0 ? perWin[o] / perSamples[o] : 0,
    ),
  };
}

/** Equity against the given number of completely random hands. */
export function equityVsRandom(
  hero: readonly Card[],
  board: readonly Card[],
  opponentCount: number,
  rng: Rng,
  iterations = DEFAULT_ITERATIONS,
): EquityResult {
  const known: Card[] = [...hero, ...board];
  const used = new Uint8Array(DECK_SIZE);
  let win = 0;
  let tie = 0;
  let lose = 0;
  const fullBoard: Card[] = new Array(5);
  const boardToDeal = 5 - board.length;

  for (let iter = 0; iter < iterations; iter++) {
    used.fill(0);
    for (const card of known) used[card] = 1;

    const oppCards: Card[] = [];
    for (let i = 0; i < opponentCount * 2; i++) {
      let card = 0;
      do {
        card = (rng() * DECK_SIZE) | 0;
      } while (used[card]);
      used[card] = 1;
      oppCards.push(card);
    }
    for (let i = 0; i < board.length; i++) fullBoard[i] = board[i];
    for (let i = 0; i < boardToDeal; i++) {
      let card = 0;
      do {
        card = (rng() * DECK_SIZE) | 0;
      } while (used[card]);
      used[card] = 1;
      fullBoard[board.length + i] = card;
    }

    const heroScore = evaluate([...hero, ...fullBoard]);
    let best = heroScore;
    let ties = 0;
    let beaten = false;
    for (let o = 0; o < opponentCount; o++) {
      const score = evaluate([oppCards[o * 2], oppCards[o * 2 + 1], ...fullBoard]);
      if (score > best) {
        best = score;
        beaten = true;
        ties = 0;
      } else if (score === heroScore) ties += 1;
    }
    if (beaten) lose += 1;
    else if (ties > 0) tie += 1 / (ties + 1);
    else win += 1;
  }

  return {
    equity: (win + tie) / iterations,
    win: win / iterations,
    tie: tie / iterations,
    lose: lose / iterations,
    samples: iterations,
    perOpponent: [],
  };
}
