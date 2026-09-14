import { formatMoney, formatMoneyWithBB } from "../money";
import { describeRangeWidth } from "../opponents/opponentRange";
import type { HandState } from "../types";
import { CONCEPTS } from "./concepts";
import type { GradedDecision } from "./grade";
import type { Recommendation, ScoredAction } from "./recommend";

export interface Explanation {
  /** Plain-English name of the recommended play, e.g. "Raise to $4". */
  recommended: string;
  /**
   * The whole reason in one line. This is what the feedback panel leads with;
   * everything below is available behind "Show details".
   */
  oneLiner: string;
  /** The two numbers that actually drove the decision. */
  keyNumbers: Array<{ label: string; value: string; hint?: string }>;
  /** Where the equity number came from, so it can be checked rather than trusted. */
  equityWorking: EquityWorking;
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

/** One opponent's contribution to the equity estimate. */
export interface OpponentWorking {
  seat: number;
  name: string;
  profileName: string;
  /** What they did, in words: "limped", "raised", "bet big". */
  readLabel: string;
  /** How many two-card combinations their range still contains. */
  combos: number;
  /** That range as a share of all starting hands. */
  widthPercent: number;
  /** Hero's equity against this player alone. */
  equityVs: number;
}

export interface EquityWorking {
  /** How many runouts were simulated. */
  runouts: number;
  win: number;
  tie: number;
  lose: number;
  /** Cards already known, for the line that says what was dealt. */
  boardCards: number;
  opponents: OpponentWorking[];
}

const READ_LABELS: Record<string, string> = {
  passive: "checked",
  called: "called",
  smallBet: "bet small",
  bet: "bet",
  bigBet: "bet big",
  raised: "raised",
};

function readLabel(read: string, preflop: boolean, hasActed: boolean): string {
  // "passive" covers both checking and not having acted yet, which are very
  // different reads, so they get different words.
  if (read === "passive") return hasActed ? "checked" : "yet to act";
  if (preflop && read === "called") return "limped or called";
  return READ_LABELS[read] ?? read;
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

  // The headline: one short line saying why, in the terms of the concept being
  // taught rather than the full spot-specific paragraph.
  const oneLiner = rec.best.short;

  const equityHint = `from ${rec.equity.samples.toLocaleString()} simulated runouts`;
  const keyNumbers =
    rec.toCall > 0
      ? [
          {
            label: "Your equity",
            value: `${Math.round(rec.equity.equity * 100)}%`,
            hint: equityHint,
          },
          {
            label: "You need",
            value: `${Math.round(rec.potOdds * 100)}%`,
            hint: `calling ${formatMoney(rec.toCall)} into ${formatMoney(rec.pot)}`,
          },
        ]
      : [
          {
            label: "Your equity",
            value: `${Math.round(rec.equity.equity * 100)}%`,
            hint: equityHint,
          },
          { label: "Pot", value: formatMoney(rec.pot) },
        ];

  const equityWorking: EquityWorking = {
    runouts: rec.equity.samples,
    win: rec.equity.win,
    tie: rec.equity.tie,
    lose: rec.equity.lose,
    boardCards: state.board.length,
    opponents: rec.opponents.map((read, index) => ({
      seat: read.seat,
      name: state.players[read.seat].name,
      profileName: read.profile.name,
      readLabel: readLabel(
        read.read,
        rec.street === "preflop",
        state.history.some(
          (a) => a.seat === read.seat && a.street === state.street && a.type !== "post",
        ),
      ),
      combos: read.range.length,
      widthPercent: read.width,
      equityVs: rec.equity.perOpponent[index] ?? 0,
    })),
  };

  return {
    recommended: bestText,
    oneLiner,
    keyNumbers,
    equityWorking,
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
