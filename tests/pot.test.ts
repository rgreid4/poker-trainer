import { describe, expect, it } from "vitest";
import { awardPots, buildPots, potOdds } from "@/lib/pot";
import type { PlayerState } from "@/lib/types";

function player(seat: number, totalCommitted: number, status: PlayerState["status"] = "active"): PlayerState {
  return {
    seat,
    name: `P${seat}`,
    isHero: false,
    profile: "station",
    stack: 0,
    committed: 0,
    totalCommitted,
    status,
    hole: [],
    revealed: false,
  };
}

describe("pot construction", () => {
  it("builds a single pot when everyone committed the same", () => {
    const pots = buildPots([player(0, 500), player(1, 500), player(2, 500)]);
    expect(pots).toHaveLength(1);
    expect(pots[0].amount).toBe(1500);
    expect(pots[0].eligible).toEqual([0, 1, 2]);
  });

  it("creates a side pot the short stack cannot win", () => {
    // Seat 0 is all-in for 300, seats 1 and 2 continue to 1000.
    const pots = buildPots([player(0, 300, "allin"), player(1, 1000), player(2, 1000)]);
    expect(pots).toHaveLength(2);
    expect(pots[0].amount).toBe(900); // 300 x 3
    expect(pots[0].eligible).toEqual([0, 1, 2]);
    expect(pots[1].amount).toBe(1400); // 700 x 2
    expect(pots[1].eligible).toEqual([1, 2]);
    expect(pots[1].isSidePot).toBe(true);
  });

  it("keeps dead money from folded players in the pot but not their eligibility", () => {
    const pots = buildPots([player(0, 500), player(1, 500), player(2, 200, "folded")]);
    expect(pots.reduce((sum, p) => sum + p.amount, 0)).toBe(1200);
    for (const pot of pots) expect(pot.eligible).not.toContain(2);
  });

  it("handles three all-ins of different sizes", () => {
    const pots = buildPots([
      player(0, 100, "allin"),
      player(1, 400, "allin"),
      player(2, 1000, "allin"),
      player(3, 1000),
    ]);
    expect(pots.map((p) => p.amount)).toEqual([400, 900, 1200]);
    expect(pots.map((p) => p.eligible.length)).toEqual([4, 3, 2]);
  });

  it("never loses or invents chips", () => {
    const players = [player(0, 137), player(1, 981, "folded"), player(2, 450, "allin"), player(3, 981)];
    const total = players.reduce((sum, p) => sum + p.totalCommitted, 0);
    const pots = buildPots(players);
    expect(pots.reduce((sum, p) => sum + p.amount, 0)).toBe(total);
  });
});

describe("pot awards", () => {
  it("gives each pot to the best eligible hand", () => {
    const pots = buildPots([player(0, 300, "allin"), player(1, 1000), player(2, 1000)]);
    // Seat 0 has the best hand but is only eligible for the main pot.
    const results = awardPots(pots, { 0: 900, 1: 800, 2: 700 }, [0, 1, 2]);
    expect(results[0].winners).toEqual([0]);
    expect(results[0].awarded[0]).toBe(900);
    expect(results[1].winners).toEqual([1]);
    expect(results[1].awarded[1]).toBe(1400);
  });

  it("splits a tied pot and gives the odd cent to the first seat in order", () => {
    // 1497 cents in the main pot between two tied players does not divide evenly.
    const pots = buildPots([player(0, 501), player(1, 501), player(2, 499, "folded")]);
    const results = awardPots(pots, { 0: 500, 1: 500 }, [1, 0]);
    expect(results[0].winners.sort()).toEqual([0, 1]);
    expect(results[0].amount).toBe(1497);
    expect(results[0].awarded[1]).toBe(749);
    expect(results[0].awarded[0]).toBe(748);

    const awardedTotal = results.reduce(
      (sum, pot) => sum + Object.values(pot.awarded).reduce((a, b) => a + b, 0),
      0,
    );
    expect(awardedTotal).toBe(1501);
  });

  it("computes pot odds as the price of the call", () => {
    // Calling 100 into a pot of 300 needs 25% equity.
    expect(potOdds(300, 100)).toBeCloseTo(0.25, 10);
    expect(potOdds(100, 100)).toBeCloseTo(0.5, 10);
    expect(potOdds(500, 0)).toBe(0);
  });
});
