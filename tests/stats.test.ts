import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_TRACKED_MISTAKES,
  STATS_STORAGE_KEY,
  accuracy,
  clearStats,
  emptyStats,
  formatAccuracy,
  loadStats,
  overallAccuracy,
  recordDecision,
  recordHand,
  saveStats,
  weakestConcepts,
} from "@/lib/stats";
import type { DecisionRecord } from "@/lib/strategy/decision";
import type { Grade } from "@/lib/strategy/grade";
import type { Street } from "@/lib/types";

function record(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    street: "flop",
    grade: "best",
    gap: 0,
    concept: "value-bet-bigger",
    chosenLabel: "Bet $2",
    recommendedLabel: "Bet $2",
    explanation: {
      recommended: "Bet $2",
      sentences: ["Bet $2 is the play.", "They call too much, so size up."],
      numbers: [],
      conceptId: "value-bet-bigger",
      conceptName: "Value Bet Bigger",
      conceptBlurb: "",
      houseGameNote: null,
      closeNote: null,
    },
    equity: 0.62,
    potOdds: 0,
    potBefore: 400,
    houseAdjustment: true,
    close: false,
    handLabel: "Pair of Aces — top pair, good kicker",
    ...overrides,
  };
}

describe("stats totals", () => {
  it("counts decisions, grades and accuracy", () => {
    let stats = emptyStats();
    stats = recordDecision(stats, record({ grade: "best" }));
    stats = recordDecision(stats, record({ grade: "good" }));
    stats = recordDecision(stats, record({ grade: "acceptable" }));
    stats = recordDecision(stats, record({ grade: "mistake", gap: 0.3 }));

    expect(stats.decisions).toBe(4);
    expect(stats.goodOrBetter).toBe(2);
    expect(overallAccuracy(stats)).toBeCloseTo(0.5, 10);
    expect(stats.byGrade.best).toBe(1);
    expect(stats.byGrade.mistake).toBe(1);
    expect(formatAccuracy(overallAccuracy(stats))).toBe("50%");
    expect(formatAccuracy(null)).toBe("—");
  });

  it("tracks accuracy by street", () => {
    let stats = emptyStats();
    const streets: Street[] = ["preflop", "preflop", "turn"];
    const grades: Grade[] = ["best", "blunder", "good"];
    streets.forEach((street, i) => {
      stats = recordDecision(stats, record({ street, grade: grades[i] }));
    });

    expect(stats.byStreet.preflop).toEqual({ decisions: 2, good: 1 });
    expect(stats.byStreet.turn).toEqual({ decisions: 1, good: 1 });
    expect(accuracy(stats.byStreet.preflop)).toBeCloseTo(0.5, 10);
    expect(accuracy(stats.byStreet.river)).toBeNull();
  });

  it("tracks accuracy by concept and ranks the weakest first", () => {
    let stats = emptyStats();
    stats = recordDecision(stats, record({ concept: "value-bet-bigger", grade: "best" }));
    stats = recordDecision(stats, record({ concept: "value-bet-bigger", grade: "good" }));
    stats = recordDecision(stats, record({ concept: "dont-bluff-stations", grade: "blunder" }));
    stats = recordDecision(stats, record({ concept: "dont-bluff-stations", grade: "mistake" }));
    stats = recordDecision(stats, record({ concept: "pot-odds", grade: "best" }));

    const weakest = weakestConcepts(stats);
    expect(weakest[0].concept).toBe("dont-bluff-stations");
    expect(weakest[0].accuracy).toBe(0);
    expect(weakest.map((w) => w.concept)).not.toContain("pot-odds"); // only one decision
  });

  it("keeps a capped list of the most recent mistakes, newest first", () => {
    let stats = emptyStats();
    for (let i = 0; i < MAX_TRACKED_MISTAKES + 5; i++) {
      stats = recordDecision(
        stats,
        record({ grade: "blunder", gap: 0.6, chosenLabel: `Call $${i}` }),
        1000 + i,
      );
    }
    expect(stats.mistakes).toHaveLength(MAX_TRACKED_MISTAKES);
    expect(stats.mistakes[0].chosenLabel).toBe(`Call $${MAX_TRACKED_MISTAKES + 4}`);
    expect(stats.mistakes[0].lesson).toMatch(/size up/);
  });

  it("does not record good decisions as mistakes", () => {
    let stats = emptyStats();
    stats = recordDecision(stats, record({ grade: "acceptable" }));
    expect(stats.mistakes).toHaveLength(0);
  });

  it("counts hands and money, and ignores money for drills", () => {
    let stats = emptyStats();
    stats = recordHand(stats, 1250);
    stats = recordHand(stats, -400);
    stats = recordHand(stats); // a drill: no money involved
    expect(stats.handsPlayed).toBe(3);
    expect(stats.netCents).toBe(850);
  });
});

describe("stats persistence", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("round-trips through storage", () => {
    let stats = emptyStats();
    stats = recordDecision(stats, record({ grade: "mistake", gap: 0.4 }));
    stats = recordHand(stats, 500);
    saveStats(stats);

    const loaded = loadStats();
    expect(loaded.decisions).toBe(1);
    expect(loaded.handsPlayed).toBe(1);
    expect(loaded.netCents).toBe(500);
    expect(loaded.mistakes).toHaveLength(1);
    expect(loaded.byStreet.flop.decisions).toBe(1);
  });

  it("starts fresh when storage is empty, corrupt or a different version", () => {
    expect(loadStats().decisions).toBe(0);

    store.set(STATS_STORAGE_KEY, "not json at all");
    expect(loadStats().decisions).toBe(0);

    store.set(STATS_STORAGE_KEY, JSON.stringify({ version: 99, decisions: 40 }));
    expect(loadStats().decisions).toBe(0);
  });

  it("fills in fields missing from an older saved snapshot", () => {
    store.set(
      STATS_STORAGE_KEY,
      JSON.stringify({ version: 1, decisions: 7, goodOrBetter: 4, handsPlayed: 2 }),
    );
    const loaded = loadStats();
    expect(loaded.decisions).toBe(7);
    expect(loaded.byStreet.river).toEqual({ decisions: 0, good: 0 });
    expect(loaded.byConcept).toEqual({});
    expect(loaded.mistakes).toEqual([]);
  });

  it("clears everything on reset", () => {
    saveStats(recordHand(emptyStats(), 100));
    expect(loadStats().handsPlayed).toBe(1);
    clearStats();
    expect(loadStats().handsPlayed).toBe(0);
  });
});
