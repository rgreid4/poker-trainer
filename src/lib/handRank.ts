import { HandCategory, type HandScore, categoryOf, ranksOf } from "./evaluator";

const SINGULAR = [
  "Deuce", "Three", "Four", "Five", "Six", "Seven", "Eight",
  "Nine", "Ten", "Jack", "Queen", "King", "Ace",
];

const PLURAL = [
  "Deuces", "Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights",
  "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces",
];

export function rankName(rank: number): string {
  return SINGULAR[rank] ?? "?";
}

export function rankNamePlural(rank: number): string {
  return PLURAL[rank] ?? "?";
}

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: "High card",
  [HandCategory.Pair]: "One pair",
  [HandCategory.TwoPair]: "Two pair",
  [HandCategory.ThreeOfAKind]: "Three of a kind",
  [HandCategory.Straight]: "Straight",
  [HandCategory.Flush]: "Flush",
  [HandCategory.FullHouse]: "Full house",
  [HandCategory.FourOfAKind]: "Four of a kind",
  [HandCategory.StraightFlush]: "Straight flush",
};

/** Human-readable showdown text, e.g. "Two pair, Kings and Sevens". */
export function describeScore(score: HandScore): string {
  const category = categoryOf(score);
  const r = ranksOf(score);
  switch (category) {
    case HandCategory.StraightFlush:
      return r[0] === 12 ? "Royal flush" : `Straight flush, ${rankName(r[0])} high`;
    case HandCategory.FourOfAKind:
      return `Four of a kind, ${rankNamePlural(r[0])}`;
    case HandCategory.FullHouse:
      return `Full house, ${rankNamePlural(r[0])} full of ${rankNamePlural(r[1])}`;
    case HandCategory.Flush:
      return `Flush, ${rankName(r[0])} high`;
    case HandCategory.Straight:
      return `Straight, ${rankName(r[0])} high`;
    case HandCategory.ThreeOfAKind:
      return `Three of a kind, ${rankNamePlural(r[0])}`;
    case HandCategory.TwoPair:
      return `Two pair, ${rankNamePlural(r[0])} and ${rankNamePlural(r[1])}`;
    case HandCategory.Pair:
      return `Pair of ${rankNamePlural(r[0])}`;
    default:
      return `${rankName(r[0])} high`;
  }
}

export function categoryName(score: HandScore): string {
  return CATEGORY_NAMES[categoryOf(score)];
}
