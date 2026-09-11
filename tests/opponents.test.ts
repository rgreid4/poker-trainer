import { describe, expect, it } from "vitest";
import { makeRng, parseCards } from "@/lib/cards";
import { analyzeHand } from "@/lib/handAnalysis";
import { applyAction, isHandOver } from "@/lib/handEngine";
import { chooseOpponentAction } from "@/lib/opponents/opponentAI";
import { startHand } from "@/lib/dealer";
import type { ProfileId } from "@/lib/opponents/profiles";
import { testHand } from "./helpers";

describe("hand analysis", () => {
  it("recognises top pair and its kicker", () => {
    const good = analyzeHand(parseCards("Ah Kc"), parseCards("Ad 8s 3c"));
    expect(good.tier).toBe("top_pair_good_kicker");
    expect(good.pairKind).toBe("top");

    const weak = analyzeHand(parseCards("Ah 4c"), parseCards("Ad 8s 3c"));
    expect(weak.tier).toBe("top_pair_weak_kicker");
  });

  it("recognises overpairs, middle pairs and air", () => {
    expect(analyzeHand(parseCards("Kh Kc"), parseCards("9d 8s 3c")).tier).toBe("overpair");
    expect(analyzeHand(parseCards("8h 7c"), parseCards("9d 8s 3c")).tier).toBe("marginal_pair");
    // QJ has a gutshot to the ten, so a hand with nothing at all is Q2.
    expect(analyzeHand(parseCards("Qh Jc"), parseCards("9d 8s 3c")).tier).toBe("weak_draw");
    expect(analyzeHand(parseCards("Qh 2c"), parseCards("9d 8s 3c")).tier).toBe("air");
  });

  it("spots flush draws, open enders and gutshots", () => {
    const flushDraw = analyzeHand(parseCards("Th 9h"), parseCards("Ah 7h 2c"));
    expect(flushDraw.draws.flushDraw).toBe(true);
    expect(flushDraw.tier).toBe("strong_draw");

    const openEnder = analyzeHand(parseCards("Ts 9c"), parseCards("8h 7d 2c"));
    expect(openEnder.draws.openEnded).toBe(true);
    expect(openEnder.draws.outs).toBe(8);

    const gutshot = analyzeHand(parseCards("Ts 8c"), parseCards("7h 6d 2c"));
    expect(gutshot.draws.gutshot).toBe(true);
    expect(gutshot.tier).toBe("weak_draw");
  });

  it("ranks made hands above draws", () => {
    expect(analyzeHand(parseCards("9h 9c"), parseCards("9d 8s 3c")).tier).toBe("strong");
    expect(analyzeHand(parseCards("9h 8c"), parseCards("9d 8s 3c")).tier).toBe("two_pair");
    expect(analyzeHand(parseCards("6h 5c"), parseCards("9d 8s 7c")).tier).toBe("monster");
  });
});

/** Run one profile through many decisions and count what it does. */
function tally(profile: ProfileId, seed: number, hands = 400) {
  const rng = makeRng(seed);
  const counts = { fold: 0, call: 0, check: 0, aggressive: 0, decisions: 0 };
  for (let i = 0; i < hands; i++) {
    let state = startHand({
      rng,
      heroSeat: 0,
      settings: { tableSize: 6 },
      profiles: ["hero", profile, profile, profile, profile, profile],
    });
    let steps = 0;
    while (!isHandOver(state) && state.actingSeat !== null && steps < 60) {
      const seat = state.actingSeat;
      if (state.players[seat].isHero) {
        // The hero folds so we only measure opponent behaviour.
        const facing = state.currentBet > state.players[seat].committed;
        state = applyAction(state, facing ? { type: "fold" } : { type: "check" });
        steps++;
        continue;
      }
      const action = chooseOpponentAction(state, rng);
      counts.decisions++;
      if (action.type === "fold") counts.fold++;
      else if (action.type === "call") counts.call++;
      else if (action.type === "check") counts.check++;
      else counts.aggressive++;
      state = applyAction(state, action);
      steps++;
    }
  }
  return counts;
}

describe("opponent profiles behave like the players they model", () => {
  it("calling stations call far more than they fold", () => {
    const counts = tally("station", 11);
    const callRate = counts.call / counts.decisions;
    const foldRate = counts.fold / counts.decisions;
    expect(callRate).toBeGreaterThan(foldRate);
    expect(counts.aggressive / counts.decisions).toBeLessThan(0.2);
  });

  it("tight players fold much more often than stations", () => {
    const tight = tally("tight", 12);
    const station = tally("station", 12);
    expect(tight.fold / tight.decisions).toBeGreaterThan(station.fold / station.decisions);
  });

  it("maniacs bet and raise far more than anyone else", () => {
    const maniac = tally("maniac", 13);
    const limper = tally("limper", 13);
    expect(maniac.aggressive / maniac.decisions).toBeGreaterThan(
      limper.aggressive / limper.decisions,
    );
    expect(maniac.aggressive / maniac.decisions).toBeGreaterThan(0.2);
  });

  it("limpers limp rather than raise when first into the pot", () => {
    const rng = makeRng(99);
    let limps = 0;
    let raises = 0;
    for (let i = 0; i < 300; i++) {
      const state = startHand({
        rng,
        heroSeat: 0,
        settings: { tableSize: 6 },
        profiles: ["hero", "limper", "limper", "limper", "limper", "limper"],
      });
      if (state.actingSeat === null || state.players[state.actingSeat].isHero) continue;
      const action = chooseOpponentAction(state, rng);
      if (action.type === "call") limps++;
      if (action.type === "raise") raises++;
    }
    expect(limps).toBeGreaterThan(raises * 2);
  });

  it("never produces an illegal action", () => {
    const rng = makeRng(4242);
    for (let i = 0; i < 300; i++) {
      let state = startHand({ rng, heroSeat: 0, settings: { tableSize: 2 + (i % 8) } });
      let steps = 0;
      while (!isHandOver(state) && state.actingSeat !== null && steps < 80) {
        const seat = state.actingSeat;
        const action = state.players[seat].isHero
          ? { type: "fold" as const }
          : chooseOpponentAction(state, rng);
        if (state.players[seat].isHero && state.currentBet === state.players[seat].committed) {
          state = applyAction(state, { type: "check" });
        } else {
          state = applyAction(state, action);
        }
        steps++;
      }
      expect(isHandOver(state)).toBe(true);
    }
  });

  it("folds top pair only rarely as a station, and more often as a tight player", () => {
    // A station facing a pot sized bet with top pair.
    const build = (profile: ProfileId) => {
      const rng = makeRng(5150);
      let folds = 0;
      const trials = 300;
      for (let i = 0; i < trials; i++) {
        let state = testHand({
          tableSize: 2,
          buttonSeat: 0,
          heroSeat: 0,
          profiles: ["hero", profile],
          holes: { 0: "2c 3d", 1: "Ah Kc" },
          board: "Ad 8s 3h",
        });
        state = applyAction(state, { type: "call" }); // hero calls on the button
        state = applyAction(state, { type: "check" }); // big blind checks, flop comes
        state = applyAction(state, { type: "check" }); // big blind checks the flop
        state = applyAction(state, { type: "bet", to: 100 }); // hero bets the pot
        const action = chooseOpponentAction(state, rng);
        if (action.type === "fold") folds++;
      }
      return folds / trials;
    };
    expect(build("station")).toBeLessThan(0.1);
    expect(build("tight")).toBeGreaterThan(build("station"));
  });
});
