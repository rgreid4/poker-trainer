import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/cards";
import { callCost, limperCount } from "@/lib/betting";
import { DEFAULT_SETTINGS } from "@/lib/dealer";
import { analyzeHand, tierRank } from "@/lib/handAnalysis";
import { isHandOver } from "@/lib/handEngine";
import { readOpponent } from "@/lib/opponents/opponentRange";
import { isCallingStation } from "@/lib/opponents/profiles";
import { PRACTICE_MODES, practiceMode } from "@/lib/practice/modes";
import { setupPractice } from "@/lib/practice/spots";
import type { HandState } from "@/lib/types";

const settings = { ...DEFAULT_SETTINGS, tableSize: 6 };

function setup(mode: Parameters<typeof setupPractice>[0], seed: number) {
  return setupPractice(mode, makeRng(seed), settings);
}

function heroIsToAct(state: HandState): boolean {
  return (
    !isHandOver(state) && state.actingSeat !== null && state.players[state.actingSeat].isHero
  );
}

function livePlayers(state: HandState): number {
  return state.players.filter((p) => p.status !== "folded").length;
}

describe("practice modes", () => {
  it("lists a mode for every drill the trainer offers", () => {
    expect(PRACTICE_MODES.map((m) => m.id)).toEqual([
      "full",
      "preflop",
      "iso",
      "multiway",
      "thin-value",
      "fold-to-aggression",
      "draws",
      "short-stack",
    ]);
    expect(practiceMode("iso").kind).toBe("spot");
    expect(practiceMode("nonsense" as "iso").id).toBe("full");
    // Every spot drill explains what it guarantees.
    for (const mode of PRACTICE_MODES.filter((m) => m.kind === "spot")) {
      expect(mode.setupNote).toBeTruthy();
    }
  });
});

describe("spot generation", () => {
  it("hands the hero a decision in every mode", () => {
    for (const mode of PRACTICE_MODES) {
      for (let seed = 1; seed <= 5; seed++) {
        const { state } = setup(mode.id, seed * 31 + mode.id.length);
        // Either the hero is to act, or the opponents still have to act first
        // and the UI will play them out.
        expect(isHandOver(state)).toBe(false);
        expect(state.actingSeat).not.toBeNull();
      }
    }
  });

  it("sets up an isolation spot with limpers and no raise", () => {
    let matched = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { state, fallback } = setup("iso", seed * 7);
      if (fallback) continue;
      matched += 1;
      expect(state.street).toBe("preflop");
      expect(limperCount(state)).toBeGreaterThanOrEqual(1);
      expect(state.history.some((a) => a.type === "raise")).toBe(false);
      expect(heroIsToAct(state)).toBe(true);
    }
    expect(matched).toBeGreaterThan(5);
  });

  it("sets up a multiway pot after the flop", () => {
    let matched = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { state, fallback } = setup("multiway", seed * 13);
      if (fallback) continue;
      matched += 1;
      expect(state.street).not.toBe("preflop");
      expect(livePlayers(state)).toBeGreaterThanOrEqual(3);
    }
    expect(matched).toBeGreaterThan(5);
  });

  it("sets up a thin value spot: a middling hand, no bet, a station still in", () => {
    let matched = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { state, fallback } = setup("thin-value", seed * 17);
      if (fallback) continue;
      matched += 1;
      const hero = state.players[state.config.heroSeat];
      const tier = tierRank(analyzeHand(hero.hole, state.board).tier);
      expect(tier).toBeGreaterThanOrEqual(tierRank("marginal_pair"));
      expect(tier).toBeLessThanOrEqual(tierRank("top_pair_weak_kicker"));
      expect(callCost(state, state.actingSeat as number)).toBe(0);
      expect(
        state.players.some((p) => p.status !== "folded" && !p.isHero && isCallingStation(p.profile)),
      ).toBe(true);
    }
    expect(matched).toBeGreaterThan(4);
  });

  it("sets up a passive player getting aggressive against a one pair hand", () => {
    let matched = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { state, fallback } = setup("fold-to-aggression", seed * 23);
      if (fallback) continue;
      matched += 1;
      const seat = state.actingSeat as number;
      expect(callCost(state, seat)).toBeGreaterThan(0);
      const aggressor = readOpponent(state, state.lastAggressor as number);
      expect(aggressor?.aggressionIsCredible).toBe(true);
      expect(isCallingStation(aggressor!.profile.id)).toBe(true);
      const hero = state.players[state.config.heroSeat];
      const tier = tierRank(analyzeHand(hero.hole, state.board).tier);
      expect(tier).toBeGreaterThanOrEqual(tierRank("weak_pair"));
      expect(tier).toBeLessThanOrEqual(tierRank("overpair"));
    }
    expect(matched).toBeGreaterThan(3);
  });

  it("sets up a draw with several players in the pot", () => {
    let matched = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const { state, fallback } = setup("draws", seed * 29);
      if (fallback) continue;
      matched += 1;
      const hero = state.players[state.config.heroSeat];
      const tier = analyzeHand(hero.hole, state.board).tier;
      expect(["strong_draw", "weak_draw"]).toContain(tier);
      expect(livePlayers(state)).toBeGreaterThanOrEqual(3);
      expect(["flop", "turn"]).toContain(state.street);
    }
    expect(matched).toBeGreaterThan(3);
  });

  it("sets up a short stack of fifteen big blinds or fewer", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { state, fallback } = setup("short-stack", seed * 37);
      expect(fallback).toBe(false);
      const hero = state.players[state.config.heroSeat];
      const bb = (hero.stack + hero.committed) / state.config.bigBlind;
      expect(bb).toBeLessThanOrEqual(15);
      expect(bb).toBeGreaterThan(3);
      expect(state.street).toBe("preflop");
    }
  });

  it("leaves stacks alone outside the short-stack drill", () => {
    const { state } = setup("multiway", 5);
    const total = state.players.reduce((sum, p) => sum + p.stack + p.totalCommitted, 0);
    expect(total).toBe(state.config.startingStack * state.config.tableSize);
  });
});
