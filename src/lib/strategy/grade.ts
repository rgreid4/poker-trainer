import { GRADE_GAPS } from "@/data/thresholds";
import type { ActionInput } from "../handEngine";
import type { LegalAction } from "../types";
import type { Recommendation, ScoredAction } from "./recommend";

export type Grade = "best" | "good" | "acceptable" | "mistake" | "blunder";

export const GRADE_LABELS: Record<Grade, string> = {
  best: "Best",
  good: "Good",
  acceptable: "Acceptable",
  mistake: "Mistake",
  blunder: "Blunder",
};

/** Tailwind classes for the grade badge. */
export const GRADE_STYLES: Record<Grade, string> = {
  best: "bg-emerald-500/25 text-emerald-100 ring-emerald-400/50",
  good: "bg-lime-500/20 text-lime-100 ring-lime-400/40",
  acceptable: "bg-amber-500/20 text-amber-100 ring-amber-400/40",
  mistake: "bg-orange-600/25 text-orange-100 ring-orange-400/40",
  blunder: "bg-rose-600/30 text-rose-100 ring-rose-400/50",
};

export const GRADE_ORDER: Grade[] = ["best", "good", "acceptable", "mistake", "blunder"];

/** Good or better is the bar the stats screen tracks. */
export function isGoodOrBetter(grade: Grade): boolean {
  return grade === "best" || grade === "good";
}

export interface GradedDecision {
  grade: Grade;
  chosen: ScoredAction;
  best: ScoredAction;
  /** How much worse the chosen action scored than the best one. */
  gap: number;
}

function sameAction(a: LegalAction, b: ActionInput): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "bet" || a.type === "raise") return a.to === b.to;
  return true;
}

/**
 * Grade a decision by how far it falls short of the best available action,
 * never by how the hand turned out. A correct call that loses to a river card
 * is still a correct call.
 */
export function gradeDecision(rec: Recommendation, choice: ActionInput): GradedDecision {
  const chosen =
    rec.scores.find((s) => sameAction(s.action, choice)) ??
    // An amount we did not offer as a button: grade it as the nearest option of
    // the same type so custom sizings still get feedback.
    rec.scores
      .filter((s) => s.action.type === choice.type)
      .sort(
        (a, b) =>
          Math.abs(a.action.to - (choice.to ?? 0)) - Math.abs(b.action.to - (choice.to ?? 0)),
      )[0];

  if (!chosen) {
    return { grade: "mistake", chosen: rec.best, best: rec.best, gap: 0 };
  }

  const gap = rec.best.score - chosen.score;
  return { grade: gradeForGap(gap), chosen, best: rec.best, gap };
}

export function gradeForGap(gap: number): Grade {
  if (gap <= 0) return "best";
  if (gap <= GRADE_GAPS.good) return "good";
  if (gap <= GRADE_GAPS.acceptable) return "acceptable";
  if (gap <= GRADE_GAPS.mistake) return "mistake";
  return "blunder";
}
