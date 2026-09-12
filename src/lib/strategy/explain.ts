import { formatMoney, formatMoneyWithBB } from "../money";
import { describeRangeWidth } from "../opponents/opponentRange";
import type { HandState } from "../types";
import { CONCEPTS } from "./concepts";
import type { GradedDecision } from "./grade";
import type { Recommendation, ScoredAction } from "./recommend";

export interface Explanation {
  /** Plain-English name of the recommended play, e.g. "Raise to $4". */
  recommended: string;
  /** Two to four sentences on why, in terms of how these opponents play. */
  sentences: string[];
  /** The numbers behind the decision, labelled for display. */
  numbers: Array<{ label: string; value: string; hint?: string }>;
  conceptId: Recommendation["best"]["concept"];
  conceptName: string;
  conceptBlurb: string;
  /** Set when the recommendation is a house-game exploit rather than good poker everywhere. */
  houseGameNote: string | null;
  /** Set when the spot is close and more than one action is fine. */
  closeNote: string | null;
}

export function describeAction(action: ScoredAction["action"], bigBlind: number): string {
  switch (action.type) {
    case "fold":
      return "Fold";
    case "check":
      return "Check";
    case "call":
      return action.allIn ? `Call all in for ${formatMoney(action.cost)}` : `Call ${formatMoney(action.cost)}`;
    case "bet":
      return action.allIn
        ? `Bet all in for ${formatMoney(action.to)}`
        : `Bet ${formatMoneyWithBB(action.to, bigBlind)}`;
    case "raise":
      return action.allIn
        ? `Raise all in to ${formatMoney(action.to)}`
        : `Raise to ${formatMoneyWithBB(action.to, bigBlind)}`;
  }
}

/**
 * Turn a recommendation and the player's actual choice into feedback: what was
 * best, why in terms of these specific opponents, and the numbers behind it.
 */
export function explain(
  state: HandState,
  rec: Recommendation,
  decision: GradedDecision,
): Explanation {
  const bb = state.config.bigBlind;
  const concept = CONCEPTS[rec.best.concept];
  const sentences: string[] = [];

  const bestText = describeAction(rec.best.action, bb);
  if (decision.grade === "best") {
    sentences.push(`${bestText} is the play.`);
  } else {
    sentences.push(`${bestText} is better here.`);
  }

  if (rec.best.reason) sentences.push(rec.best.reason);

  // Say what was wrong with what they actually did, when it was not the best.
  if (decision.chosen !== rec.best && decision.chosen.reason) {
    sentences.push(decision.chosen.reason);
  }

  // Who is in the pot and what they are like.
  const opponentNote = describeOpponents(rec);
  if (opponentNote && sentences.length < 4) sentences.push(opponentNote);

  const numbers: Explanation["numbers"] = [];

  numbers.push({
    label: "Your hand",
    value: rec.handLabel,
  });

  numbers.push({
    label: "Equity",
    value: `${Math.round(rec.equity.equity * 100)}%`,
    hint:
      rec.playersInPot > 2
        ? `against ${rec.playersInPot - 1} opponents' estimated ranges`
        : "against their estimated range",
  });

  if (rec.toCall > 0) {
    numbers.push({
      label: "Pot odds",
      value: `${Math.round(rec.potOdds * 100)}%`,
      // rec.pot is the pot as it stands before the hero puts the call in.
      hint: `calling ${formatMoney(rec.toCall)} into ${formatMoney(rec.pot)}`,
    });
  }

  numbers.push({
    label: "Pot",
    value: formatMoneyWithBB(rec.pot, bb),
  });

  if (Number.isFinite(rec.spr)) {
    numbers.push({
      label: "SPR",
      value: rec.spr.toFixed(1),
      hint: sprHint(rec.spr),
    });
  }

  numbers.push({
    label: "Position",
    value: rec.position + (rec.inPosition ? " (in position)" : ""),
  });

  const closeNote = rec.close
    ? `This one is close: ${rec.alsoFine
        .map((s) => describeAction(s.action, bb))
        .join(" and ")} are all defensible. Do not read too much into the grade.`
    : null;

  const houseGameNote = concept.houseGameSpecific
    ? "This is a house-game adjustment. Against strong, balanced players it would be a leak."
    : null;

  return {
    recommended: bestText,
    sentences: sentences.slice(0, 4),
    numbers,
    conceptId: rec.best.concept,
    conceptName: concept.name,
    conceptBlurb: concept.blurb,
    houseGameNote,
    closeNote,
  };
}

function sprHint(spr: number): string {
  if (spr <= 1.5) return "committed — plan to get it in with a strong hand";
  if (spr <= 4) return "shallow — top pair is a big hand";
  if (spr <= 10) return "medium";
  return "deep — one pair is worth less";
}

function describeOpponents(rec: Recommendation): string | null {
  if (rec.opponents.length === 0) return null;

  const aggressive = rec.opponents.find((o) => o.aggressionIsCredible);
  if (aggressive) {
    const player = aggressive.profile;
    return `${player.name}: ${player.blurb} Their range here is ${describeRangeWidth(aggressive.width)}.`;
  }

  const widest = [...rec.opponents].sort((a, b) => b.width - a.width)[0];
  return `${widest.profile.name}: ${widest.profile.blurb} Their range here is ${describeRangeWidth(widest.width)}.`;
}

/**
 * The line the trainer shows when a correct decision lost the pot. Grading the
 * decision rather than the result is the whole point of the exercise.
 */
export function resultHonestyNote(
  goodDecisions: number,
  totalDecisions: number,
  netCents: number,
): string | null {
  if (totalDecisions === 0) return null;
  const playedWell = goodDecisions === totalDecisions;
  if (playedWell && netCents < 0) {
    return "You played this hand correctly and still lost it. That is normal: loose players hit lucky rivers often, and the same calls that cost you here are exactly what pays you off over a session. The grade is for the decision, not the result.";
  }
  if (!playedWell && netCents > 0) {
    return "You won the pot, but some of these decisions were still mistakes. Winning a hand you played badly is the most expensive kind of lesson, because it teaches the wrong habit.";
  }
  return null;
}
