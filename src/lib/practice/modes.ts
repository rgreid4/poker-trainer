/**
 * Practice modes. "Full hands" is the default; the preflop drill is for fast
 * reps; the spot drills deal until the specific house-game situation comes up
 * and hand you the decision.
 */
export type PracticeModeId =
  | "full"
  | "preflop"
  | "iso"
  | "multiway"
  | "thin-value"
  | "fold-to-aggression"
  | "draws"
  | "short-stack";

export interface PracticeMode {
  id: PracticeModeId;
  name: string;
  /** One line for the picker. */
  blurb: string;
  kind: "full" | "preflop" | "spot";
  /** What the generator guarantees about the spot, shown above the table. */
  setupNote?: string;
}

export const PRACTICE_MODES: PracticeMode[] = [
  {
    id: "full",
    name: "Full hands",
    blurb: "Play every street from the deal to showdown.",
    kind: "full",
  },
  {
    id: "preflop",
    name: "Preflop drill",
    blurb: "One preflop decision per hand, graded immediately. Fast reps.",
    kind: "preflop",
    setupNote: "Preflop only — you get one decision, then the next hand.",
  },
  {
    id: "iso",
    name: "Isolating limpers",
    blurb: "Someone has limped in. Raise big, call, or fold?",
    kind: "spot",
    setupNote: "At least one player has limped in and nobody has raised.",
  },
  {
    id: "multiway",
    name: "Multiway pots",
    blurb: "Three or more players see the flop. One pair is worth less.",
    kind: "spot",
    setupNote: "Three or more players are still in the pot after the flop.",
  },
  {
    id: "thin-value",
    name: "Thin value vs stations",
    blurb: "A medium made hand and a player who calls too much. Bet or check?",
    kind: "spot",
    setupNote:
      "You have a middling made hand, nobody has bet, and at least one player who calls far too much is still in.",
  },
  {
    id: "fold-to-aggression",
    name: "Folding to passive aggression",
    blurb: "A player who never bluffs just got aggressive. Believe them?",
    kind: "spot",
    setupNote:
      "A loose-passive player has raised or fired big at you, and you hold a one-pair type hand.",
  },
  {
    id: "draws",
    name: "Draws with callers",
    blurb: "A draw in a crowded pot. Price, implied odds, or fold?",
    kind: "spot",
    setupNote: "You are on a draw with three or more players in the pot.",
  },
  {
    id: "short-stack",
    name: "Short-stack all-ins",
    blurb: "Fifteen big blinds or fewer. Shove or fold?",
    kind: "spot",
    setupNote: "You are down to 15 big blinds or fewer before the flop.",
  },
];

export function practiceMode(id: PracticeModeId): PracticeMode {
  return PRACTICE_MODES.find((mode) => mode.id === id) ?? PRACTICE_MODES[0];
}

export const DEFAULT_MODE: PracticeModeId = "full";
