import { describe, expect, it } from "vitest";
import { parseCards } from "@/lib/cards";
import { HandCategory, categoryOf, evaluate } from "@/lib/evaluator";
import { describeScore } from "@/lib/handRank";

const score = (text: string) => evaluate(parseCards(text));
const cat = (text: string) => categoryOf(score(text));

describe("hand evaluator", () => {
  it("identifies every category from seven cards", () => {
    expect(cat("As Ks Qs Js Ts 2c 7d")).toBe(HandCategory.StraightFlush);
    expect(cat("9h 9c 9s 9d 2c 7d Kh")).toBe(HandCategory.FourOfAKind);
    expect(cat("9h 9c 9s 2d 2c 7d Kh")).toBe(HandCategory.FullHouse);
    expect(cat("Ah 7h 5h 3h 2h 9c Kd")).toBe(HandCategory.Flush);
    expect(cat("9h 8c 7s 6d 5c 2d Kh")).toBe(HandCategory.Straight);
    expect(cat("9h 9c 9s 2d 5c 7d Kh")).toBe(HandCategory.ThreeOfAKind);
    expect(cat("9h 9c 5s 5d 2c 7d Kh")).toBe(HandCategory.TwoPair);
    expect(cat("9h 9c 3s 5d 2c 7d Kh")).toBe(HandCategory.Pair);
    expect(cat("9h Jc 3s 5d 2c 7d Kh")).toBe(HandCategory.HighCard);
  });

  it("reads the wheel as a five-high straight", () => {
    expect(cat("Ah 2c 3s 4d 5h Kc Qd")).toBe(HandCategory.Straight);
    expect(describeScore(score("Ah 2c 3s 4d 5h Kc Qd"))).toBe("Straight, Five high");
    // A six-high straight beats the wheel.
    expect(score("2c 3s 4d 5h 6c Kd 9s")).toBeGreaterThan(score("Ah 2c 3s 4d 5h Kc Qd"));
  });

  it("ranks a steel wheel straight flush", () => {
    expect(cat("Ah 2h 3h 4h 5h Kc Qd")).toBe(HandCategory.StraightFlush);
    expect(describeScore(score("Ah 2h 3h 4h 5h Kc Qd"))).toBe("Straight flush, Five high");
    expect(describeScore(score("As Ks Qs Js Ts 2c 7d"))).toBe("Royal flush");
  });

  it("orders the categories correctly", () => {
    const ordered = [
      "2c 7d 9h Jc 4s",
      "2c 2d 9h Jc 4s",
      "2c 2d 9h 9c 4s",
      "2c 2d 2h 9c 4s",
      "5c 6d 7h 8c 9s",
      "2c 7c 9c Jc 4c",
      "2c 2d 2h 9c 9s",
      "2c 2d 2h 2s 9s",
      "5c 6c 7c 8c 9c",
    ].map(score);
    for (let i = 1; i < ordered.length; i++) {
      expect(ordered[i]).toBeGreaterThan(ordered[i - 1]);
    }
  });

  it("compares kickers", () => {
    // Same pair of kings, ace kicker wins.
    expect(score("Kh Kc As 5d 3c 2h 7d")).toBeGreaterThan(score("Kh Kc Qs 5d 3c 2h 7d"));
    // Identical five-card hands played from different holdings tie exactly.
    expect(score("Ah Ac Ks Kd Qh 2c 3d")).toBe(score("Ah Ac Ks Kd Qh 4c 5d"));
  });

  it("picks the best five from seven when a better flush is available", () => {
    const withHigherFlush = score("As Ks 9s 4s 2s 3h 3d");
    const lowerFlush = score("Qs Js 9s 4s 2s 3h 3d");
    expect(withHigherFlush).toBeGreaterThan(lowerFlush);
  });

  it("prefers the full house over the flush when both are present", () => {
    expect(cat("As Ks 9s 4s 2s Ah Ad")).toBe(HandCategory.Flush);
    expect(cat("As Ah Ad Ks Kh 4s 2s")).toBe(HandCategory.FullHouse);
  });

  it("uses the higher trips for the full house with two sets", () => {
    expect(describeScore(score("9h 9c 9s 5d 5c 5h Kd"))).toBe("Full house, Nines full of Fives");
  });

  it("describes hands in plain English", () => {
    expect(describeScore(score("Kh Kc 7s 7d 3c 2h 9d"))).toBe("Two pair, Kings and Sevens");
    expect(describeScore(score("Kh Kc 8s 7d 3c 2h 9d"))).toBe("Pair of Kings");
    expect(describeScore(score("Kh Qc 8s 7d 3c 2h 9d"))).toBe("King high");
    expect(describeScore(score("Kh Kc Ks 7d 3c 2h 9d"))).toBe("Three of a kind, Kings");
  });
});
