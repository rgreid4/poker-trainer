import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/cards";
import { applyAction } from "@/lib/handEngine";
import { gradeDecision } from "@/lib/strategy/grade";
import { explain } from "@/lib/strategy/explain";
import { type Recommendation, recommend } from "@/lib/strategy/recommend";
import type { ActionInput } from "@/lib/handEngine";
import type { HandState } from "@/lib/types";
import type { ProfileId } from "@/lib/opponents/profiles";
import { testHand } from "./helpers";

const ITERATIONS = 1500;

function advise(state: HandState, seed = 99): Recommendation {
  return recommend({ state, rng: makeRng(seed), iterations: ITERATIONS });
}

function grade(state: HandState, choice: ActionInput, seed = 99) {
  const rec = advise(state, seed);
  return { rec, ...gradeDecision(rec, choice) };
}

/** Score of the best action of a given type. */
function scoreOf(rec: Recommendation, type: string): number {
  const matches = rec.scores.filter((s) => s.action.type === type);
  return matches.length > 0 ? Math.max(...matches.map((s) => s.score)) : -1;
}

describe("preflop recommendations", () => {
  it("raises aces from under the gun and never calls a fold good", () => {
    const state = testHand({ holes: { 3: "As Ac" }, heroSeat: 3 });
    const rec = advise(state);
    expect(rec.best.action.type).toBe("raise");
    expect(rec.best.concept).toBe("raise-dont-limp");

    const folded = gradeDecision(rec, { type: "fold" });
    expect(folded.grade).toBe("blunder");
    const limped = gradeDecision(rec, { type: "call" });
    expect(["mistake", "acceptable"]).toContain(limped.grade);
  });

  it("prefers a bigger isolation raise over limpers", () => {
    // Two limpers, hero on the button with a strong ace.
    let state = testHand({ heroSeat: 0, buttonSeat: 0, holes: { 0: "As Qs" } });
    state = applyAction(state, { type: "call" }); // UTG limps
    state = applyAction(state, { type: "call" }); // MP limps
    state = applyAction(state, { type: "fold" }); // CO folds
    expect(state.actingSeat).toBe(0);

    const rec = advise(state);
    expect(rec.best.action.type).toBe("raise");
    expect(rec.best.concept).toBe("isolate-limpers");
    expect(rec.best.houseAdjustment).toBe(true);
    // The raise should be bigger than a standard 3x open with two limpers in.
    expect(rec.best.action.to).toBeGreaterThanOrEqual(250);
    expect(gradeDecision(rec, { type: "call" }).grade).not.toBe("best");
  });

  it("folds junk from early position", () => {
    const state = testHand({ holes: { 3: "7c 2d" }, heroSeat: 3 });
    const rec = advise(state);
    expect(rec.best.action.type).toBe("fold");
    expect(rec.best.concept).toBe("fold-preflop");
    const raised = gradeDecision(rec, { type: "raise", to: 150 });
    expect(["mistake", "blunder"]).toContain(raised.grade);
  });

  it("3-bets kings for value against a raise", () => {
    let state = testHand({ heroSeat: 5, holes: { 5: "Ks Kd" } });
    state = applyAction(state, { type: "raise", to: 150 }); // UTG opens
    state = applyAction(state, { type: "fold" });
    expect(state.actingSeat).toBe(5);

    const rec = advise(state);
    expect(rec.best.action.type).toBe("raise");
    expect(rec.best.concept).toBe("three-bet-value");
    expect(gradeDecision(rec, { type: "fold" }).grade).toBe("blunder");
  });

  it("folds a dominated ace to a passive player's raise", () => {
    // A calling station who raises has a genuinely strong range.
    let state = testHand({
      heroSeat: 5,
      // AJo sits inside a normal calling range but is dominated by the tight
      // range a passive player actually raises.
      holes: { 5: "Ad Jc" },
      profiles: ["station", "station", "station", "station", "station", "hero"],
    });
    state = applyAction(state, { type: "raise", to: 200 }); // the station raises
    state = applyAction(state, { type: "fold" });

    const rec = advise(state);
    expect(rec.best.action.type).toBe("fold");
    expect(rec.best.concept).toBe("respect-passive-aggression");
    expect(rec.best.houseAdjustment).toBe(true);
  });

  it("shoves a short stack rather than opening small", () => {
    const state = testHand({
      heroSeat: 3,
      holes: { 3: "Ah Js" },
      stacks: [2500, 2500, 2500, 400, 2500, 2500],
    });
    const rec = advise(state);
    expect(rec.best.action.allIn).toBe(true);
    expect(rec.best.concept).toBe("short-stack-shove");
  });
});

describe("postflop recommendations", () => {
  /** Hero in the big blind, one station on the button, flop checked to hero. */
  function heroVsStationOnFlop(heroCards: string, board: string, profile: ProfileId = "station") {
    let state = testHand({
      tableSize: 2,
      buttonSeat: 1,
      heroSeat: 0,
      profiles: ["hero", profile],
      holes: { 0: heroCards, 1: "7c 2d" },
      board,
    });
    state = applyAction(state, { type: "call" }); // button completes
    state = applyAction(state, { type: "check" }); // hero checks the option
    expect(state.street).toBe("flop");
    // Hero is the big blind, so hero acts first postflop.
    return state;
  }

  it("bets big for value with top pair against a calling station", () => {
    const state = heroVsStationOnFlop("Ah Kc", "Ad 8s 3h");
    const rec = advise(state);
    expect(rec.best.action.type).toBe("bet");
    expect(["value-bet-bigger", "charge-draws"]).toContain(rec.best.concept);
    // The preferred size should be at least three quarters of the pot.
    expect(rec.best.action.to).toBeGreaterThanOrEqual(Math.round(rec.pot * 0.7));
    expect(gradeDecision(rec, { type: "check" }).grade).not.toBe("best");
  });

  it("bets top pair with a weak kicker for thin value heads up", () => {
    const state = heroVsStationOnFlop("Ah 4c", "Ad 8s 3h");
    const rec = advise(state);
    expect(rec.best.action.type).toBe("bet");
    expect(rec.best.concept).toBe("thin-value");
    expect(rec.best.houseAdjustment).toBe(true);
  });

  it("checks and gives up with no pair and no draw against a station", () => {
    const state = heroVsStationOnFlop("Qh Jc", "Ad 8s 3h");
    const rec = advise(state);
    expect(rec.best.action.type).toBe("check");
    expect(rec.best.concept).toBe("dont-bluff-stations");

    const bluff = rec.scores.find((s) => s.action.type === "bet");
    expect(bluff).toBeDefined();
    expect(gradeDecision(rec, { type: "bet", to: bluff?.action.to }).grade).toMatch(
      /mistake|blunder/,
    );
  });

  it("does not slow-play a set", () => {
    const state = heroVsStationOnFlop("8h 8c", "Ad 8s 3h");
    const rec = advise(state);
    expect(rec.best.action.type).toBe("bet");
    expect(rec.best.concept).toBe("dont-slow-play");
    expect(scoreOf(rec, "check")).toBeLessThan(scoreOf(rec, "bet"));
  });

  it("grades a river bluff with nothing against a station as a mistake", () => {
    let state = testHand({
      tableSize: 2,
      buttonSeat: 1,
      heroSeat: 0,
      profiles: ["hero", "station"],
      holes: { 0: "Qh Jc", 1: "Ac 5d" },
      board: "Ad 8s 3h 7c 2s",
    });
    state = applyAction(state, { type: "call" });
    state = applyAction(state, { type: "check" });
    // Check the flop, turn and river down to hero's river decision.
    for (let i = 0; i < 4; i++) state = applyAction(state, { type: "check" });
    expect(state.street).toBe("river");

    const rec = advise(state);
    expect(rec.best.action.type).toBe("check");
    const bet = rec.scores.find((s) => s.action.type === "bet");
    const graded = gradeDecision(rec, { type: "bet", to: bet?.action.to });
    expect(["mistake", "blunder"]).toContain(graded.grade);
    expect(graded.chosen.concept).toBe("dont-bluff-stations");
  });
});

describe("facing aggression", () => {
  /** Hero faces a bet of `betTo` from a profiled opponent on the flop. */
  function heroFacingBet(
    heroCards: string,
    villainCards: string,
    board: string,
    betTo: number,
    profile: ProfileId = "station",
    raiseFirst = false,
  ) {
    let state = testHand({
      tableSize: 2,
      buttonSeat: 0,
      heroSeat: 0,
      profiles: ["hero", profile],
      holes: { 0: heroCards, 1: villainCards },
      board,
    });
    state = applyAction(state, { type: "call" }); // hero completes on the button
    state = applyAction(state, { type: "check" }); // villain checks the option
    // Postflop the big blind (villain) acts first.
    if (raiseFirst) {
      state = applyAction(state, { type: "bet", to: 50 }); // villain leads small
      state = applyAction(state, { type: "raise", to: 200 }); // hero raises
      state = applyAction(state, { type: "raise", to: betTo }); // villain raises back
    } else {
      state = applyAction(state, { type: "bet", to: betTo });
    }
    return state;
  }

  it("folds top pair to a passive player's check-raise", () => {
    const state = heroFacingBet("Ah Kc", "8d 8h", "Ad 8s 3h", 700, "station", true);
    const rec = advise(state);
    expect(rec.best.action.type).toBe("fold");
    expect(rec.best.concept).toBe("respect-passive-aggression");
    expect(rec.best.houseAdjustment).toBe(true);
    expect(scoreOf(rec, "fold")).toBeGreaterThan(scoreOf(rec, "call"));
  });

  it("calls a flush draw when the price is right", () => {
    const state = heroFacingBet("Th 9h", "Ac Kd", "Ah 7h 2c", 100, "station");
    const rec = advise(state);
    expect(rec.best.action.type).toBe("call");
    expect(rec.best.concept).toBe("draws-need-a-price");
    expect(gradeDecision(rec, { type: "fold" }).grade).toMatch(/mistake|blunder|acceptable/);
  });

  it("folds a gutshot facing a big bet", () => {
    const state = heroFacingBet("Th 8c", "Ac Kd", "Ad 7h 2c", 900, "station");
    const rec = advise(state);
    expect(rec.best.action.type).toBe("fold");
    expect(scoreOf(rec, "fold")).toBeGreaterThan(scoreOf(rec, "call"));
  });

  it("raises a station's small bet with top pair for value", () => {
    // The minimum bet is one big blind, so a genuinely small bet relative to
    // the pot needs a pot that has already been raised.
    let state = testHand({
      tableSize: 2,
      buttonSeat: 0,
      heroSeat: 0,
      profiles: ["hero", "station"],
      holes: { 0: "Ah Kc", 1: "9d 5h" },
      board: "Ad 8s 3h",
    });
    state = applyAction(state, { type: "raise", to: 150 }); // hero opens
    state = applyAction(state, { type: "call" }); // the station calls
    expect(state.street).toBe("flop");
    state = applyAction(state, { type: "bet", to: 50 }); // a tiny stab into a $3 pot

    const rec = advise(state);
    expect(rec.best.action.type).toBe("raise");
    expect(rec.best.concept).toBe("value-bet-bigger");
    expect(rec.best.action.to).toBeGreaterThan(150);
  });
});

describe("grading", () => {
  it("calls the top action best and a small step down good", () => {
    const state = testHand({ holes: { 3: "As Ac" }, heroSeat: 3 });
    const rec = advise(state);
    expect(gradeDecision(rec, { type: rec.best.action.type, to: rec.best.action.to }).grade).toBe(
      "best",
    );

    // A second raise size should not be punished hard.
    const otherRaise = rec.scores.find(
      (s) => s.action.type === "raise" && s.action.to !== rec.best.action.to && !s.action.allIn,
    );
    if (otherRaise) {
      const graded = gradeDecision(rec, { type: "raise", to: otherRaise.action.to });
      expect(["best", "good", "acceptable"]).toContain(graded.grade);
    }
  });

  it("grades an unoffered custom size against the nearest option", () => {
    const state = testHand({ holes: { 3: "As Ac" }, heroSeat: 3 });
    const rec = advise(state);
    const graded = gradeDecision(rec, { type: "raise", to: 155 });
    expect(graded.chosen.action.type).toBe("raise");
    expect(["best", "good"]).toContain(graded.grade);
  });

  it("never grades folding the best hand preflop as playable", () => {
    for (const hand of ["As Ac", "Ks Kd", "As Ks"]) {
      const state = testHand({ holes: { 3: hand }, heroSeat: 3 });
      const rec = advise(state);
      const folded = gradeDecision(rec, { type: "fold" });
      expect(["mistake", "blunder"]).toContain(folded.grade);
    }
  });
});

describe("explanations", () => {
  it("explains the play, the opponents and the numbers", () => {
    const state = testHand({ holes: { 3: "As Ac" }, heroSeat: 3 });
    const { rec, ...decision } = grade(state, { type: "fold" });
    const text = explain(state, rec, decision);

    expect(text.recommended).toMatch(/^Raise to/);
    expect(text.sentences.length).toBeGreaterThanOrEqual(2);
    expect(text.sentences.length).toBeLessThanOrEqual(4);
    expect(text.conceptName).toBe("Raise, Don't Limp");

    const labels = text.numbers.map((n) => n.label);
    expect(labels).toContain("Equity");
    expect(labels).toContain("Pot");
    expect(labels).toContain("Position");
    expect(labels).toContain("Your hand");
  });

  it("flags house-game adjustments and close spots honestly", () => {
    const state = testHand({
      tableSize: 2,
      buttonSeat: 1,
      heroSeat: 0,
      profiles: ["hero", "station"],
      holes: { 0: "Ah 4c", 1: "7c 2d" },
      board: "Ad 8s 3h",
    });
    let s = applyAction(state, { type: "call" });
    s = applyAction(s, { type: "check" });

    const rec = advise(s);
    const text = explain(s, rec, gradeDecision(rec, { type: "check" }));
    expect(text.houseGameNote).toMatch(/house-game adjustment/i);
    expect(text.conceptName).toBe("Thin Value");
  });

  it("says so when a correct decision lost the hand", async () => {
    const { resultHonestyNote } = await import("@/lib/strategy/explain");
    expect(resultHonestyNote(3, 3, -1200)).toMatch(/played this hand correctly and still lost/i);
    expect(resultHonestyNote(1, 3, 1200)).toMatch(/still mistakes/i);
    expect(resultHonestyNote(3, 3, 800)).toBeNull();
  });
});

describe("equity and range modelling", () => {
  it("narrows a passive player's range when they raise", () => {
    let loose = testHand({
      heroSeat: 5,
      holes: { 5: "Ad Ts" },
      profiles: ["station", "station", "station", "station", "station", "hero"],
    });
    loose = applyAction(loose, { type: "call" }); // UTG limps
    const limpRead = advise(loose).opponents.find((o) => o.seat === 3);

    let raised = testHand({
      heroSeat: 5,
      holes: { 5: "Ad Ts" },
      profiles: ["station", "station", "station", "station", "station", "hero"],
    });
    raised = applyAction(raised, { type: "raise", to: 200 });
    const raiseRead = advise(raised).opponents.find((o) => o.seat === 3);

    expect(limpRead).toBeDefined();
    expect(raiseRead).toBeDefined();
    expect(raiseRead!.width).toBeLessThan(limpRead!.width);
    expect(raiseRead!.read).toBe("raised");
  });

  it("reports lower equity multiway than heads up with the same hand", () => {
    const headsUp = testHand({
      tableSize: 2,
      buttonSeat: 0,
      heroSeat: 0,
      holes: { 0: "As Ks" },
    });
    const sixWay = testHand({ tableSize: 6, buttonSeat: 0, heroSeat: 3, holes: { 3: "As Ks" } });
    expect(advise(sixWay).equity.equity).toBeLessThan(advise(headsUp).equity.equity);
  });
});

describe("showing the working behind the equity", () => {
  it("reports the runouts, how they finished, and each opponent's modelled range", () => {
    let state = testHand({
      heroSeat: 5,
      holes: { 5: "Ah Kd" },
      profiles: ["station", "limper", "station", "station", "station", "hero"],
    });
    state = applyAction(state, { type: "raise", to: 200 }); // UTG raises
    state = applyAction(state, { type: "call" }); // MP calls
    state = applyAction(state, { type: "fold" });
    state = applyAction(state, { type: "fold" });

    const rec = advise(state);
    const working = explain(state, rec, gradeDecision(rec, { type: "call" })).equityWorking;

    expect(working.runouts).toBe(ITERATIONS);
    expect(working.win + working.tie + working.lose).toBeCloseTo(1, 5);
    expect(working.boardCards).toBe(0);

    // One entry per live opponent, each with a real range behind it.
    expect(working.opponents).toHaveLength(rec.opponents.length);
    for (const opponent of working.opponents) {
      expect(opponent.name).toBeTruthy();
      expect(opponent.combos).toBeGreaterThan(0);
      expect(opponent.widthPercent).toBeGreaterThan(0);
      expect(opponent.widthPercent).toBeLessThanOrEqual(1);
      expect(opponent.equityVs).toBeGreaterThan(0);
      expect(opponent.equityVs).toBeLessThanOrEqual(1);
    }

    // The raiser is on a narrower range than the caller, and says so.
    const raiser = working.opponents.find((o) => o.readLabel === "raised");
    const caller = working.opponents.find((o) => o.readLabel === "limped or called");
    expect(raiser).toBeDefined();
    expect(caller).toBeDefined();
    expect(raiser!.combos).toBeLessThan(caller!.combos);

    // Equity against the field is never better than against any one of them.
    for (const opponent of working.opponents) {
      expect(rec.equity.equity).toBeLessThanOrEqual(opponent.equityVs + 0.001);
    }
  });

  it("counts the cards still to come", () => {
    let state = testHand({
      tableSize: 2,
      buttonSeat: 0,
      heroSeat: 0,
      profiles: ["hero", "station"],
      holes: { 0: "Ah Kc", 1: "9d 5h" },
      board: "Ad 8s 3h",
    });
    state = applyAction(state, { type: "call" });
    state = applyAction(state, { type: "check" });
    state = applyAction(state, { type: "check" });

    const rec = advise(state);
    const working = explain(state, rec, gradeDecision(rec, { type: "check" })).equityWorking;
    expect(working.boardCards).toBe(3);
    expect(working.opponents).toHaveLength(1);
    expect(working.opponents[0].profileName).toBe("Calling station");
  });
});

describe("describing what each opponent did", () => {
  it("separates players who checked from players who have not acted yet", () => {
    let state = testHand({
      heroSeat: 5,
      holes: { 5: "Ah Kd" },
      profiles: ["station", "station", "station", "station", "station", "hero"],
    });
    state = applyAction(state, { type: "call" }); // UTG limps
    state = applyAction(state, { type: "fold" }); // MP folds, so the hero is up
    expect(state.actingSeat).toBe(5);

    const rec = advise(state);
    const working = explain(state, rec, gradeDecision(rec, { type: "fold" })).equityWorking;

    const limper = working.opponents.find((o) => o.seat === 3);
    // The button has not had a turn yet when the hero acts from the cutoff.
    const waiting = working.opponents.find((o) => o.seat === 0);
    expect(limper?.readLabel).toBe("limped or called");
    expect(waiting?.readLabel).toBe("yet to act");
  });
});
