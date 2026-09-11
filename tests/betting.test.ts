import { describe, expect, it } from "vitest";
import { callCost, legalActions, limperCount, minRaiseTo, raiseBounds } from "@/lib/betting";
import { applyAction } from "@/lib/handEngine";
import { testHand } from "./helpers";

describe("legal actions", () => {
  it("offers fold, call and raises to the first player preflop", () => {
    const state = testHand();
    const actions = legalActions(state);
    const types = new Set(actions.map((a) => a.type));
    expect(types.has("fold")).toBe(true);
    expect(types.has("call")).toBe(true);
    expect(types.has("raise")).toBe(true);
    expect(types.has("check")).toBe(false);
    expect(actions.find((a) => a.type === "call")?.cost).toBe(50);
  });

  it("lets the big blind check when everyone limps", () => {
    let state = testHand();
    // UTG through the button call, small blind completes.
    for (let i = 0; i < 4; i++) state = applyAction(state, { type: "call" });
    state = applyAction(state, { type: "call" }); // small blind
    expect(state.players[state.actingSeat as number].seat).toBe(state.positions.indexOf("BB"));
    const types = legalActions(state).map((a) => a.type);
    expect(types).toContain("check");
    expect(types).not.toContain("fold");
    expect(limperCount(state)).toBe(5);
  });

  it("sizes preflop opens at 3x plus one big blind per limper", () => {
    let state = testHand();
    const openRaise = legalActions(state).find((a) => a.sizing === "open");
    expect(openRaise?.to).toBe(150); // 3bb with no limpers

    state = applyAction(state, { type: "call" }); // one limper
    const isoRaise = legalActions(state).find((a) => a.sizing === "iso");
    expect(isoRaise?.to).toBe(200); // 3bb + 1bb per limper
  });

  it("offers half pot, three quarter pot and pot sized bets postflop", () => {
    let state = testHand();
    for (let i = 0; i < 5; i++) state = applyAction(state, { type: "call" });
    state = applyAction(state, { type: "check" }); // big blind checks, flop comes
    expect(state.street).toBe("flop");

    const bets = legalActions(state).filter((a) => a.type === "bet");
    const pot = 300; // six players at 50 cents each
    expect(bets.find((b) => b.sizing === "half")?.to).toBe(pot / 2);
    expect(bets.find((b) => b.sizing === "threequarter")?.to).toBe(225);
    expect(bets.find((b) => b.sizing === "pot")?.to).toBe(pot);
  });
});

describe("raise legality", () => {
  it("requires a raise to match the size of the last raise", () => {
    let state = testHand();
    expect(minRaiseTo(state)).toBe(100); // big blind is the opening increment
    state = applyAction(state, { type: "raise", to: 200 });
    expect(minRaiseTo(state)).toBe(350); // 200 plus the 150 raise
    expect(() => applyAction(state, { type: "raise", to: 300 })).toThrow(/minimum/i);
    expect(() => applyAction(state, { type: "raise", to: 350 })).not.toThrow();
  });

  it("rejects a raise that is not a raise at all", () => {
    const state = testHand();
    expect(() => applyAction(state, { type: "raise", to: 50 })).toThrow(/exceed/i);
    expect(() => applyAction(state, { type: "check" })).toThrow(/check/i);
  });

  it("caps a raise at the player stack and marks it all in", () => {
    const state = testHand({ stacks: [2500, 2500, 2500, 400, 2500, 2500] });
    const bounds = raiseBounds(state, state.actingSeat as number);
    expect(bounds).not.toBeNull();
    expect(() => applyAction(state, { type: "raise", to: 99999 })).toThrow(/stack/i);
  });

  it("allows a short all-in below the minimum raise", () => {
    // Under the gun (seat 3) acts first with only 120 behind, which is less
    // than a min raise.
    const state = testHand({ stacks: [2500, 2500, 2500, 120, 2500, 2500] });
    expect(state.actingSeat).toBe(3);
    const allIn = legalActions(state).find((a) => a.allIn && a.type === "raise");
    expect(allIn?.to).toBe(120);
    const next = applyAction(state, { type: "raise", to: 120 });
    expect(next.players[3].status).toBe("allin");
    expect(next.players[3].stack).toBe(0);
  });

  it("does not reopen the betting after a short all-in", () => {
    // Seat 3 opens to 200, seat 4 is all-in for 260 (a raise of only 60),
    // so seat 3 may call but may not raise again.
    let state = testHand({ stacks: [2500, 2500, 2500, 2500, 260, 2500] });
    state = applyAction(state, { type: "raise", to: 200 });
    expect(state.actingSeat).toBe(4);
    state = applyAction(state, { type: "raise", to: 260 });

    // Action passes round the table; everyone else folds back to seat 3.
    while (state.actingSeat !== 3) state = applyAction(state, { type: "fold" });
    const types = legalActions(state).map((a) => a.type);
    expect(types).toContain("call");
    expect(types).not.toContain("raise");
  });

  it("reopens the betting after a full raise", () => {
    let state = testHand();
    state = applyAction(state, { type: "raise", to: 200 });
    state = applyAction(state, { type: "raise", to: 600 });
    while (state.actingSeat !== 3) state = applyAction(state, { type: "fold" });
    const types = legalActions(state).map((a) => a.type);
    expect(types).toContain("raise");
    expect(callCost(state, 3)).toBe(400);
  });
});
