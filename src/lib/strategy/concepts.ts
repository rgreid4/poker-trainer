/**
 * The teaching concepts behind each recommendation. Every graded decision gets
 * exactly one tag, which is also what the stats screen groups accuracy by.
 */
export type ConceptId =
  | "raise-dont-limp"
  | "isolate-limpers"
  | "position"
  | "three-bet-value"
  | "fold-preflop"
  | "short-stack-shove"
  | "value-bet-bigger"
  | "thin-value"
  | "dont-slow-play"
  | "charge-draws"
  | "dont-bluff-stations"
  | "respect-passive-aggression"
  | "pot-odds"
  | "draws-need-a-price"
  | "multiway-caution"
  | "pot-control";

export interface Concept {
  id: ConceptId;
  name: string;
  /** One or two sentences for the help panel. */
  blurb: string;
  /**
   * True when the concept is specifically a house-game exploit that would be a
   * leak against strong, balanced opponents.
   */
  houseGameSpecific: boolean;
}

export const CONCEPTS: Record<ConceptId, Concept> = {
  "raise-dont-limp": {
    id: "raise-dont-limp",
    name: "Raise, Don't Limp",
    blurb:
      "Limping invites the whole table along with a weak, capped hand. Raising takes the lead, builds a pot you have the best of, and thins the field a little even here.",
    houseGameSpecific: false,
  },
  "isolate-limpers": {
    id: "isolate-limpers",
    name: "Isolate Limpers",
    blurb:
      "When weak players limp in, raise bigger than you would at a tough table. They call anyway, so the raise is a value bet that also buys you position and initiative.",
    houseGameSpecific: true,
  },
  position: {
    id: "position",
    name: "Position",
    blurb:
      "Acting last lets you control the size of the pot and see what everyone does first. Play more hands in late position and fewer from the blinds and early seats.",
    houseGameSpecific: false,
  },
  "three-bet-value": {
    id: "three-bet-value",
    name: "3-Bet for Value",
    blurb:
      "Against players who rarely fold, 3-bet the hands that want more money in and skip the bluffs. There is no need to balance a range against someone who is not watching.",
    houseGameSpecific: true,
  },
  "fold-preflop": {
    id: "fold-preflop",
    name: "Play Tighter Than the Table",
    blurb:
      "Most of your edge comes from folding the hands your opponents play. In multiway limped pots, weak aces and offsuit junk lose money no matter how cheap they look.",
    houseGameSpecific: false,
  },
  "short-stack-shove": {
    id: "short-stack-shove",
    name: "Short Stack: Shove or Fold",
    blurb:
      "Under about 15 big blinds, raising small leaves you committed with no room to play. Get it in with the hands worth playing and fold the rest.",
    houseGameSpecific: false,
  },
  "value-bet-bigger": {
    id: "value-bet-bigger",
    name: "Value Bet Bigger",
    blurb:
      "Players who call too much do not care about price. Bet three quarters of the pot or more with your strong hands rather than the half pot you would use against thinking players.",
    houseGameSpecific: true,
  },
  "thin-value": {
    id: "thin-value",
    name: "Thin Value",
    blurb:
      "Top pair with a weak kicker, or second pair, is often good enough to bet here because these players call with less. Bet hands you would check against good players.",
    houseGameSpecific: true,
  },
  "dont-slow-play": {
    id: "dont-slow-play",
    name: "Don't Slow-Play",
    blurb:
      "Trapping is for opponents who bet for you. These players will pay you off, so bet your big hands and charge the draws instead of getting clever.",
    houseGameSpecific: true,
  },
  "charge-draws": {
    id: "charge-draws",
    name: "Charge the Draws",
    blurb:
      "On wet boards with several callers, someone is always drawing. Bet big enough that chasing is a mistake, and stop giving free cards.",
    houseGameSpecific: false,
  },
  "dont-bluff-stations": {
    id: "dont-bluff-stations",
    name: "Don't Bluff Calling Stations",
    blurb:
      "A bluff only works if someone folds. Against a player who calls with any pair or draw, betting with nothing just donates money — check and give up instead.",
    houseGameSpecific: true,
  },
  "respect-passive-aggression": {
    id: "respect-passive-aggression",
    name: "Respect Passive Aggression",
    blurb:
      "When a player who has called all night suddenly raises or fires big on the turn or river, they almost always have it. Fold your bluff-catchers, even top pair.",
    houseGameSpecific: true,
  },
  "pot-odds": {
    id: "pot-odds",
    name: "Pot Odds",
    blurb:
      "Compare the price of the call to your share of the pot. Calling $2 into a $6 pot needs 25% equity to break even.",
    houseGameSpecific: false,
  },
  "draws-need-a-price": {
    id: "draws-need-a-price",
    name: "Draws Need a Price",
    blurb:
      "Chase when the pot is laying you the odds, including the extra money you win when you hit against players who cannot fold. Fold when it is not.",
    houseGameSpecific: false,
  },
  "multiway-caution": {
    id: "multiway-caution",
    name: "Multiway Caution",
    blurb:
      "Every extra player in the pot makes one pair worse and bluffing worse. Hands that want a crowd are the ones that make straights and flushes, not weak top pairs.",
    houseGameSpecific: false,
  },
  "pot-control": {
    id: "pot-control",
    name: "Pot Control",
    blurb:
      "With a medium hand that cannot stand a raise, checking keeps the pot small and lets you get to showdown cheaply.",
    houseGameSpecific: false,
  },
};

export function conceptName(id: ConceptId): string {
  return CONCEPTS[id].name;
}

export const CONCEPT_IDS = Object.keys(CONCEPTS) as ConceptId[];

/**
 * One short line per concept and action, used for the plain feedback the
 * trainer leads with. The longer, spot-specific reasoning still sits behind
 * "Show details" — this is what you read at a glance between hands.
 */
export type ShortReasonCategory = "fold" | "check" | "call" | "aggressive";

export const CONCEPT_SHORT_REASONS: Record<
  ConceptId,
  Partial<Record<ShortReasonCategory, string>>
> = {
  "raise-dont-limp": {
    aggressive: "Good hands want a raised pot.",
    call: "Limping gives up the lead and invites everyone in.",
    check: "A free look wastes a hand worth raising.",
    fold: "This hand is too good to fold.",
  },
  "isolate-limpers": {
    aggressive: "Raise big — limpers call anyway.",
    call: "Limping along wastes the best hand at the table.",
    check: "Checking passes up a clear value raise.",
    fold: "This is well ahead of a limping range.",
  },
  position: {
    call: "Good enough to see a flop in position.",
    fold: "A little tight, but never terrible.",
    aggressive: "Raising bloats the pot with a hand that does not want one.",
  },
  "three-bet-value": {
    aggressive: "3-bet for value — they call with worse.",
    call: "Calling leaves value on the table.",
    fold: "Far too strong to fold.",
  },
  "fold-preflop": {
    fold: "Not strong enough to play from this seat.",
    call: "Cheap is not the same as profitable.",
    check: "Take the free look.",
    aggressive: "Raising this builds a pot with the worst of it.",
  },
  "short-stack-shove": {
    aggressive: "Too short to play after the flop — get it in.",
    call: "Calling leaves you committed with no way to win without hitting.",
    fold: "Too good to fold this short.",
  },
  "value-bet-bigger": {
    aggressive: "Bet big — they call too much to bet small.",
    check: "Checking here just misses value.",
    call: "Calling leaves money behind against someone who pays off raises.",
    fold: "Far too strong to fold.",
  },
  "thin-value": {
    aggressive: "Bet — worse hands call you here.",
    check: "Safe, but it passes up a bet worse hands pay off.",
    call: "Calling is fine, betting is better.",
    fold: "Too good to fold.",
  },
  "dont-slow-play": {
    aggressive: "Bet big — they will pay you off.",
    check: "Checking a big hand gives free cards and wins a small pot.",
    call: "Calling keeps the pot small with a hand that wants a big one.",
    fold: "Never fold a hand this strong.",
  },
  "charge-draws": {
    aggressive: "Bet big and make the draws pay.",
    check: "A free card is exactly what they want.",
    call: "Calling lets the draws in cheaply.",
    fold: "Much too strong to fold.",
  },
  "dont-bluff-stations": {
    check: "No hand and no fold equity — give up cheaply.",
    aggressive: "They do not fold. Do not bluff them.",
    call: "Calling with nothing hoping to improve is a donation.",
    fold: "Fold and wait for a hand.",
  },
  "respect-passive-aggression": {
    fold: "They do not bluff. Believe them and fold.",
    call: "This is how stacks disappear against passive players.",
    aggressive: "Raising into the one range that beats you is the worst option.",
  },
  "pot-odds": {
    call: "The price is right.",
    fold: "The price is wrong.",
    check: "Take the free card.",
    aggressive: "No value and no fold equity.",
  },
  "draws-need-a-price": {
    call: "Good price for the draw — call.",
    fold: "Not enough equity for this price.",
    aggressive: "Semi-bluffing needs folds, and these players do not fold.",
    check: "Take the free card.",
  },
  "multiway-caution": {
    check: "Too many players — keep the pot small.",
    call: "Cheap and multiway is when this hand plays well.",
    aggressive: "Multiway, this hand does not want a big pot.",
    fold: "Folding is perfectly fine here.",
  },
  "pot-control": {
    check: "A medium hand wants a small pot.",
    aggressive: "Betting invites a raise you cannot call.",
    call: "Calling is fine with a hand that wants showdown.",
    fold: "No need to fold this cheaply.",
  },
};

const GENERIC_SHORT: Record<ShortReasonCategory, string> = {
  fold: "Folding is the play here.",
  check: "Checking is the play here.",
  call: "Calling is the play here.",
  aggressive: "Betting is the play here.",
};

export function shortReason(concept: ConceptId, category: ShortReasonCategory): string {
  return CONCEPT_SHORT_REASONS[concept]?.[category] ?? GENERIC_SHORT[category];
}
