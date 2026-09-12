import type { Cents } from "./money";
import type { ConceptId } from "./strategy/concepts";
import type { DecisionRecord } from "./strategy/decision";
import { type Grade, GRADE_ORDER, isGoodOrBetter } from "./strategy/grade";
import { STREETS, type Street } from "./types";

export const STATS_STORAGE_KEY = "poker-trainer/stats/v1";
export const MAX_TRACKED_MISTAKES = 20;

export interface Tally {
  decisions: number;
  good: number;
}

export interface MistakeEntry {
  /** Milliseconds since the epoch, so entries can be sorted and dated. */
  at: number;
  street: Street;
  grade: Grade;
  gap: number;
  handLabel: string;
  chosenLabel: string;
  recommendedLabel: string;
  concept: ConceptId;
  /** The single most useful sentence of the explanation. */
  lesson: string;
}

export interface StatsSnapshot {
  version: 1;
  handsPlayed: number;
  decisions: number;
  goodOrBetter: number;
  byGrade: Record<Grade, number>;
  byStreet: Record<Street, Tally>;
  byConcept: Partial<Record<ConceptId, Tally>>;
  /** Net cents won or lost across full hands. Drills do not count. */
  netCents: Cents;
  /** Most recent mistakes and blunders, newest first. */
  mistakes: MistakeEntry[];
  updatedAt: number;
}

function emptyTally(): Tally {
  return { decisions: 0, good: 0 };
}

export function emptyStats(): StatsSnapshot {
  const byGrade = {} as Record<Grade, number>;
  for (const grade of GRADE_ORDER) byGrade[grade] = 0;

  const byStreet = {} as Record<Street, Tally>;
  for (const street of STREETS) byStreet[street] = emptyTally();

  return {
    version: 1,
    handsPlayed: 0,
    decisions: 0,
    goodOrBetter: 0,
    byGrade,
    byStreet,
    byConcept: {},
    netCents: 0,
    mistakes: [],
    updatedAt: Date.now(),
  };
}

/** Add one graded decision to the running totals. */
export function recordDecision(
  stats: StatsSnapshot,
  record: DecisionRecord,
  now = Date.now(),
): StatsSnapshot {
  const good = isGoodOrBetter(record.grade);
  const street = record.street;
  const streetTally = stats.byStreet[street] ?? emptyTally();
  const conceptTally = stats.byConcept[record.concept] ?? emptyTally();

  const mistakes = stats.mistakes.slice();
  if (record.grade === "mistake" || record.grade === "blunder") {
    mistakes.unshift({
      at: now,
      street,
      grade: record.grade,
      gap: record.gap,
      handLabel: record.handLabel,
      chosenLabel: record.chosenLabel,
      recommendedLabel: record.recommendedLabel,
      concept: record.concept,
      lesson: record.explanation.sentences[1] ?? record.explanation.sentences[0] ?? "",
    });
    mistakes.length = Math.min(mistakes.length, MAX_TRACKED_MISTAKES);
  }

  return {
    ...stats,
    decisions: stats.decisions + 1,
    goodOrBetter: stats.goodOrBetter + (good ? 1 : 0),
    byGrade: { ...stats.byGrade, [record.grade]: (stats.byGrade[record.grade] ?? 0) + 1 },
    byStreet: {
      ...stats.byStreet,
      [street]: { decisions: streetTally.decisions + 1, good: streetTally.good + (good ? 1 : 0) },
    },
    byConcept: {
      ...stats.byConcept,
      [record.concept]: {
        decisions: conceptTally.decisions + 1,
        good: conceptTally.good + (good ? 1 : 0),
      },
    },
    mistakes,
    updatedAt: now,
  };
}

/** Count a finished hand. `net` is omitted for drills, which are not real money. */
export function recordHand(
  stats: StatsSnapshot,
  net?: Cents,
  now = Date.now(),
): StatsSnapshot {
  return {
    ...stats,
    handsPlayed: stats.handsPlayed + 1,
    netCents: stats.netCents + (net ?? 0),
    updatedAt: now,
  };
}

export function accuracy(tally: Tally): number | null {
  if (tally.decisions === 0) return null;
  return tally.good / tally.decisions;
}

export function overallAccuracy(stats: StatsSnapshot): number | null {
  return accuracy({ decisions: stats.decisions, good: stats.goodOrBetter });
}

export function formatAccuracy(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/** Concepts with at least one decision, worst accuracy first — what to work on. */
export function weakestConcepts(
  stats: StatsSnapshot,
  minDecisions = 2,
): Array<{ concept: ConceptId; tally: Tally; accuracy: number }> {
  return Object.entries(stats.byConcept)
    .filter(([, tally]) => tally && tally.decisions >= minDecisions)
    .map(([concept, tally]) => ({
      concept: concept as ConceptId,
      tally: tally as Tally,
      accuracy: (tally as Tally).good / (tally as Tally).decisions,
    }))
    .sort((a, b) => a.accuracy - b.accuracy);
}

/**
 * Load stats from localStorage. Anything unreadable or from an older shape is
 * discarded rather than migrated, since it is only practice history.
 */
export function loadStats(): StatsSnapshot {
  if (typeof window === "undefined") return emptyStats();
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw) as Partial<StatsSnapshot>;
    if (parsed.version !== 1) return emptyStats();
    // Merge over a fresh snapshot so new fields always exist.
    const base = emptyStats();
    return {
      ...base,
      ...parsed,
      byGrade: { ...base.byGrade, ...(parsed.byGrade ?? {}) },
      byStreet: { ...base.byStreet, ...(parsed.byStreet ?? {}) },
      byConcept: { ...(parsed.byConcept ?? {}) },
      mistakes: (parsed.mistakes ?? []).slice(0, MAX_TRACKED_MISTAKES),
    } as StatsSnapshot;
  } catch {
    return emptyStats();
  }
}

export function saveStats(stats: StatsSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // A full or blocked storage quota should never break the trainer.
  }
}

export function clearStats(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STATS_STORAGE_KEY);
  } catch {
    // Ignore.
  }
}
