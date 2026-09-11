import { describe, expect, it } from "vitest";
import { makeRng, parseCards } from "@/lib/cards";
import { advanceToHero, playOutHand, startHand } from "@/lib/dealer";
import {
  applyAction,
  effectiveStack,
  effectiveStackVs,
  isHandOver,
  potNow,
} from "@/lib/handEngine";
import { assignPositions, preflopOrder } from "@/lib/table";
import { chipTotal, testHand } from "./helpers";

describe("table positions", () => {
  it("labels a six handed table from the button", () => {
    const positions = assignPositions(6, 0);
    expect(positions[0]).toBe("BTN");
    expect(positions[1]).toBe("SB");
    expect(positions[2]).toBe("BB");
    expect(positions[3]).toBe("UTG");
    expect(positions[5]).toBe("CO");
  });

  it("starts preflop action to the left of the big blind", () => {
    expect(preflopOrder(6, 0)).toEqual([3, 4, 5, 0, 1, 2]);
  });

  it("makes the button the small blind heads up", () => {
    const positions = assignPositions(2, 0);
    expect(positions).toEqual(["BTN", "BB"]);
    // The button acts first before the flop and last after it.
    expect(preflopOrder(2, 0)).toEqual([0, 1]);
  });

  it("supports every table size from two to nine", () => {
    for (let size = 2; size <= 9; size++) {
      const positions = assignPositions(size, size - 1);
      expect(new Set(positions).size).toBe(size);
      expect(positions).toContain("BTN");
      expect(positions).toContain("BB");
    }
  });
});

describe("hand setup", () => {
  it("posts the blinds and puts the first action on the player left of the big blind", () => {
    const state = testHand();
    expect(state.players[1].totalCommitted).toBe(25); // small blind
    expect(state.players[2].totalCommitted).toBe(50); // big blind
    expect(state.currentBet).toBe(50);
    expect(state.actingSeat).toBe(3);
    expect(potNow(state)).toBe(75);
  });

  it("deals two cards to everyone and none to the board", () => {
    const state = testHand();
    for (const player of state.players) expect(player.hole).toHaveLength(2);
    expect(state.board).toHaveLength(0);
    const dealt = state.players.flatMap((p) => p.hole);
    expect(new Set(dealt).size).toBe(dealt.length);
  });

  it("deals the exact cards a stacked deck specifies", () => {
    let state = testHand({ holes: { 1: "As Ah" }, board: "Kd 7c 2s" });
    expect(state.players[1].hole).toEqual(parseCards("As Ah"));
    while (state.street === "preflop" && !isHandOver(state)) {
      const player = state.players[state.actingSeat as number];
      state = applyAction(state, state.currentBet > player.committed ? { type: "call" } : { type: "check" });
    }
    expect(state.board).toEqual(parseCards("Kd 7c 2s"));
  });
});

describe("hand flow", () => {
  it("ends the hand immediately when everyone folds to one player", () => {
    let state = testHand();
    while (!isHandOver(state)) state = applyAction(state, { type: "fold" });
    expect(state.result?.wentToShowdown).toBe(false);
    expect(state.result?.summary).toMatch(/everyone else folded/);
    // The big blind wins the small blind plus their own money back.
    expect(state.players[2].stack).toBe(2500 + 25);
  });

  it("runs preflop, flop, turn and river when everyone checks it down", () => {
    let state = testHand();
    const streets: string[] = [];
    while (!isHandOver(state)) {
      streets.push(state.street);
      const player = state.players[state.actingSeat as number];
      state = applyAction(state, state.currentBet > player.committed ? { type: "call" } : { type: "check" });
    }
    expect(new Set(streets)).toEqual(new Set(["preflop", "flop", "turn", "river"]));
    expect(state.board).toHaveLength(5);
    expect(state.result?.wentToShowdown).toBe(true);
  });

  it("awards the pot to the best hand at showdown", () => {
    // Heads up: seat 0 has aces, seat 1 has deuces, board bricks out.
    let state = testHand({
      tableSize: 2,
      buttonSeat: 0,
      heroSeat: 0,
      holes: { 0: "As Ac", 1: "2d 2h" },
      board: "Kd 9c 4s 7h 3c",
    });
    while (!isHandOver(state)) {
      const player = state.players[state.actingSeat as number];
      state = applyAction(state, state.currentBet > player.committed ? { type: "call" } : { type: "check" });
    }
    expect(state.result?.showdown[0].seat).toBe(0);
    expect(state.result?.showdown[0].description).toBe("Pair of Aces");
    expect(state.result?.net[0]).toBe(50);
    expect(state.result?.net[1]).toBe(-50);
  });

  it("splits the pot on a tie", () => {
    let state = testHand({
      tableSize: 2,
      buttonSeat: 0,
      heroSeat: 0,
      holes: { 0: "As Kc", 1: "Ad Kh" },
      board: "Qd 9c 4s 7h 3c",
    });
    while (!isHandOver(state)) {
      const player = state.players[state.actingSeat as number];
      state = applyAction(state, state.currentBet > player.committed ? { type: "call" } : { type: "check" });
    }
    expect(state.result?.net[0]).toBe(0);
    expect(state.result?.net[1]).toBe(0);
    expect(state.players[0].stack).toBe(2500);
  });

  it("runs the board out and builds side pots when players are all in", () => {
    // Three players, two of them short, everyone all in preflop.
    let state = testHand({
      tableSize: 3,
      buttonSeat: 0,
      heroSeat: 0,
      stacks: [2500, 300, 1000],
      holes: { 0: "As Ac", 1: "Kd Kh", 2: "Qs Qc" },
      board: "2d 7c 9s Jh 3c",
    });
    while (!isHandOver(state)) state = applyAction(state, shoveOrCall(state));
    expect(state.board).toHaveLength(5);
    expect(state.result?.pots.length).toBeGreaterThan(1);
    // Aces win everything they are eligible for.
    expect(state.result?.net[0]).toBe(300 + 1000);
    expect(state.result?.net[1]).toBe(-300);
    expect(state.result?.net[2]).toBe(-1000);
  });

  it("gives the side pot to the second best hand when the short stack wins the main pot", () => {
    let state = testHand({
      tableSize: 3,
      buttonSeat: 0,
      heroSeat: 0,
      stacks: [300, 2500, 2500],
      holes: { 0: "As Ac", 1: "Kd Kh", 2: "Qs Qc" },
      board: "2d 7c 9s Jh 3c",
    });
    while (!isHandOver(state)) state = applyAction(state, shoveOrCall(state));
    const [main, side] = state.result?.pots ?? [];
    expect(main.winners).toEqual([0]);
    expect(main.amount).toBe(900);
    expect(side.winners).toEqual([1]); // kings beat queens for the side pot
  });

  it("never creates or destroys chips, across a thousand random hands", () => {
    const rng = makeRng(20260911);
    for (let i = 0; i < 1000; i++) {
      const tableSize = 2 + Math.floor(rng() * 8);
      const stacks = Array.from({ length: tableSize }, () => 50 + Math.floor(rng() * 60) * 50);
      const state = startHand({
        rng,
        settings: { tableSize },
        stacks,
        heroSeat: 0,
      });
      const before = chipTotal(state);
      const done = playOutHand(state, rng, (s) => {
        // The hero plays a simple mix so the fuzz covers every branch.
        const roll = rng();
        const player = s.players[s.actingSeat as number];
        const facingBet = s.currentBet > player.committed;
        if (roll < 0.15) return facingBet ? { type: "fold" } : { type: "check" };
        if (roll < 0.85) return facingBet ? { type: "call" } : { type: "check" };
        return shoveOrCall(s);
      });
      expect(isHandOver(done)).toBe(true);
      expect(chipTotal(done)).toBe(before);
      for (const player of done.players) expect(player.stack).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("dealer helpers", () => {
  it("plays opponents up to the hero decision", () => {
    const rng = makeRng(7);
    const state = startHand({ rng, heroSeat: 3, buttonSeat: 0, settings: { tableSize: 6 } });
    const advanced = advanceToHero(state, rng);
    expect(isHandOver(advanced) || advanced.players[advanced.actingSeat as number].isHero).toBe(true);
  });

  it("reports the effective stack", () => {
    const state = testHand({ stacks: [2500, 2500, 2500, 600, 2500, 2500] });
    // Against the field, the most you can win is capped by the biggest opponent.
    expect(effectiveStack(state, 3)).toBe(600);
    expect(effectiveStack(state, 0)).toBe(2500);
    // Against one specific short stack, it is the smaller of the two.
    expect(effectiveStackVs(state, 0, 3)).toBe(600);
  });
});

/** Shove if that is a legal raise, otherwise call off the rest of the stack. */
function shoveOrCall(state: import("@/lib/types").HandState) {
  const player = state.players[state.actingSeat as number];
  const to = player.committed + player.stack;
  return to > state.currentBet ? ({ type: "raise", to } as const) : ({ type: "call" } as const);
}
