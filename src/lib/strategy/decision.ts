import type { Rng } from "../cards";
import type { ActionInput } from "../handEngine";
import type { Cents } from "../money";
import type { HandState, Street } from "../types";
import type { ConceptId } from "./concepts";
import { type Explanation, describeAction, explain } from "./explain";
import { type Grade, gradeDecision, isGoodOrBetter } from "./grade";
import { type Recommendation, recommend } from "./recommend";

/** One graded hero decision, kept for the hand summary and the stats screen. */
export interface DecisionRecord {
  street: Street;
  grade: Grade;
  gap: number;
  concept: ConceptId;
  /** What the player actually did, e.g. "Call $1.50". */
  chosenLabel: string;
  /** What the engine would have done. */
  recommendedLabel: string;
  explanation: Explanation;
  equity: number;
  potOdds: number;
  potBefore: Cents;
  /** True when the recommendation is a house-game specific exploit. */
  houseAdjustment: boolean;
  /** True when the spot was close enough that several plays were fine. */
  close: boolean;
  handLabel: string;
}

export interface EvaluatedChoice {
  record: DecisionRecord;
  recommendation: Recommendation;
}

/**
 * Grade one hero decision. Called with the state as it was *before* the action,
 * so the recommendation never sees the outcome it is being judged against.
 */
export function evaluateChoice(
  state: HandState,
  choice: ActionInput,
  rng: Rng,
  iterations?: number,
): EvaluatedChoice {
  const recommendation = recommend({ state, rng, iterations });
  const decision = gradeDecision(recommendation, choice);
  const explanation = explain(state, recommendation, decision);

  return {
    recommendation,
    record: {
      street: state.street,
      grade: decision.grade,
      gap: decision.gap,
      concept: decision.chosen.concept,
      chosenLabel: describeAction(decision.chosen.action, state.config.bigBlind),
      recommendedLabel: explanation.recommended,
      explanation,
      equity: recommendation.equity.equity,
      potOdds: recommendation.potOdds,
      potBefore: recommendation.pot,
      houseAdjustment: recommendation.best.houseAdjustment,
      close: recommendation.close,
      handLabel: recommendation.handLabel,
    },
  };
}

export function countGood(decisions: readonly DecisionRecord[]): number {
  return decisions.filter((d) => isGoodOrBetter(d.grade)).length;
}
