import { type Card, RANKS, makeCard, rankOf, suitOf } from "./cards";

/**
 * A starting hand in the usual 169-cell shorthand: "AA", "AKs", "AKo".
 */
export type HandKey = string;

/** Weight 0..1 per hand key. Weights let a range say "calls with this half the time". */
export type WeightedRange = Map<HandKey, number>;

export const TOTAL_COMBOS = 1326;

export function handKey(a: Card, b: Card): HandKey {
  const ra = rankOf(a);
  const rb = rankOf(b);
  const hi = Math.max(ra, rb);
  const lo = Math.min(ra, rb);
  if (ra === rb) return `${RANKS[hi]}${RANKS[lo]}`;
  const suited = suitOf(a) === suitOf(b);
  return `${RANKS[hi]}${RANKS[lo]}${suited ? "s" : "o"}`;
}

export function isPair(key: HandKey): boolean {
  return key.length === 2;
}

export function isSuited(key: HandKey): boolean {
  return key.endsWith("s");
}

export function comboCount(key: HandKey): number {
  if (isPair(key)) return 6;
  return isSuited(key) ? 4 : 12;
}

export function allHandKeys(): HandKey[] {
  const keys: HandKey[] = [];
  for (let hi = 12; hi >= 0; hi--) {
    for (let lo = hi; lo >= 0; lo--) {
      if (hi === lo) keys.push(`${RANKS[hi]}${RANKS[lo]}`);
      else {
        keys.push(`${RANKS[hi]}${RANKS[lo]}s`);
        keys.push(`${RANKS[hi]}${RANKS[lo]}o`);
      }
    }
  }
  return keys;
}

export function ranksOfKey(key: HandKey): [number, number] {
  const hi = RANKS.indexOf(key[0] as (typeof RANKS)[number]);
  const lo = RANKS.indexOf(key[1] as (typeof RANKS)[number]);
  if (hi < 0 || lo < 0) throw new Error(`Bad hand key: ${key}`);
  return [hi, lo];
}

/** Every two-card combination that matches a hand key. */
export function combosForKey(key: HandKey): Array<[Card, Card]> {
  const [hi, lo] = ranksOfKey(key);
  const out: Array<[Card, Card]> = [];
  if (isPair(key)) {
    for (let s1 = 0; s1 < 4; s1++) {
      for (let s2 = s1 + 1; s2 < 4; s2++) out.push([makeCard(hi, s1), makeCard(hi, s2)]);
    }
    return out;
  }
  if (isSuited(key)) {
    for (let s = 0; s < 4; s++) out.push([makeCard(hi, s), makeCard(lo, s)]);
    return out;
  }
  for (let s1 = 0; s1 < 4; s1++) {
    for (let s2 = 0; s2 < 4; s2++) {
      if (s1 !== s2) out.push([makeCard(hi, s1), makeCard(lo, s2)]);
    }
  }
  return out;
}

export function rangeFromKeys(keys: Iterable<HandKey>, weight = 1): WeightedRange {
  const range: WeightedRange = new Map();
  for (const key of keys) range.set(key, weight);
  return range;
}

export function mergeRanges(...ranges: WeightedRange[]): WeightedRange {
  const merged: WeightedRange = new Map();
  for (const range of ranges) {
    for (const [key, weight] of range) {
      merged.set(key, Math.min(1, (merged.get(key) ?? 0) + weight));
    }
  }
  return merged;
}

export function scaleRange(range: WeightedRange, factor: number): WeightedRange {
  const out: WeightedRange = new Map();
  for (const [key, weight] of range) out.set(key, Math.max(0, Math.min(1, weight * factor)));
  return out;
}

/** Weighted share of all 1326 combos this range contains. */
export function rangePercent(range: WeightedRange): number {
  let combos = 0;
  for (const [key, weight] of range) combos += comboCount(key) * weight;
  return combos / TOTAL_COMBOS;
}

function rankIndex(char: string): number {
  const idx = RANKS.indexOf(char.toUpperCase() as (typeof RANKS)[number]);
  if (idx < 0) throw new Error(`Bad rank: ${char}`);
  return idx;
}

/**
 * Parse the usual range shorthand:
 *   "22+"        every pair from deuces up
 *   "JJ-88"      pairs in a span
 *   "A2s+"       A2s through AKs
 *   "KTo+"       KTo through KQo
 *   "T9s-65s"    a run of same-gap suited hands
 *   "AKs, QQ"    explicit hands, comma or space separated
 */
export function parseRange(text: string, weight = 1): WeightedRange {
  const range: WeightedRange = new Map();
  const tokens = text
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    for (const key of expandToken(token)) {
      range.set(key, Math.max(range.get(key) ?? 0, weight));
    }
  }
  return range;
}

function expandToken(token: string): HandKey[] {
  if (token.includes("-")) {
    const [fromRaw, toRaw] = token.split("-");
    return expandSpan(fromRaw, toRaw);
  }
  if (token.endsWith("+")) return expandPlus(token.slice(0, -1));
  return [normalizeKey(token)];
}

function normalizeKey(token: string): HandKey {
  const hi = rankIndex(token[0]);
  const lo = rankIndex(token[1]);
  const suffix = token.length > 2 ? token[2].toLowerCase() : "";
  const high = Math.max(hi, lo);
  const low = Math.min(hi, lo);
  if (high === low) return `${RANKS[high]}${RANKS[low]}`;
  if (suffix !== "s" && suffix !== "o") throw new Error(`Bad hand token: ${token}`);
  return `${RANKS[high]}${RANKS[low]}${suffix}`;
}

function expandPlus(base: string): HandKey[] {
  const key = normalizeKey(base);
  const [hi, lo] = ranksOfKey(key);
  const out: HandKey[] = [];
  if (isPair(key)) {
    for (let r = hi; r <= 12; r++) out.push(`${RANKS[r]}${RANKS[r]}`);
    return out;
  }
  const suffix = key[2];
  for (let r = lo; r < hi; r++) out.push(`${RANKS[hi]}${RANKS[r]}${suffix}`);
  return out;
}

function expandSpan(fromRaw: string, toRaw: string): HandKey[] {
  const a = normalizeKey(fromRaw);
  const b = normalizeKey(toRaw);
  const [aHi, aLo] = ranksOfKey(a);
  const [bHi, bLo] = ranksOfKey(b);
  const out: HandKey[] = [];

  if (isPair(a) && isPair(b)) {
    const lowEnd = Math.min(aHi, bHi);
    const highEnd = Math.max(aHi, bHi);
    for (let r = lowEnd; r <= highEnd; r++) out.push(`${RANKS[r]}${RANKS[r]}`);
    return out;
  }

  const suffix = a[2];
  if (aHi === bHi) {
    const lowEnd = Math.min(aLo, bLo);
    const highEnd = Math.max(aLo, bLo);
    for (let r = lowEnd; r <= highEnd; r++) out.push(`${RANKS[aHi]}${RANKS[r]}${suffix}`);
    return out;
  }

  // Same-gap run, e.g. T9s-65s.
  const gap = aHi - aLo;
  if (bHi - bLo !== gap) throw new Error(`Span endpoints must share a gap: ${fromRaw}-${toRaw}`);
  const lowEnd = Math.min(aHi, bHi);
  const highEnd = Math.max(aHi, bHi);
  for (let hi = lowEnd; hi <= highEnd; hi++) out.push(`${RANKS[hi]}${RANKS[hi - gap]}${suffix}`);
  return out;
}

export interface RangeCombo {
  cards: [Card, Card];
  weight: number;
}

/** Expand a range into concrete combos, dropping any that use a blocked card. */
export function rangeCombos(range: WeightedRange, blocked: readonly Card[] = []): RangeCombo[] {
  const dead = new Set(blocked);
  const out: RangeCombo[] = [];
  for (const [key, weight] of range) {
    if (weight <= 0) continue;
    for (const combo of combosForKey(key)) {
      if (dead.has(combo[0]) || dead.has(combo[1])) continue;
      out.push({ cards: combo, weight });
    }
  }
  return out;
}

export function rangeContains(range: WeightedRange, key: HandKey): boolean {
  return (range.get(key) ?? 0) > 0;
}

export function rangeToString(range: WeightedRange): string {
  return [...range.entries()]
    .filter(([, w]) => w > 0)
    .map(([key, w]) => (w >= 1 ? key : `${key}:${w.toFixed(2)}`))
    .join(", ");
}
