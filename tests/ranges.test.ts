import { describe, expect, it } from "vitest";
import { makeRng, parseCards } from "@/lib/cards";
import { estimateEquity, equityVsRandom } from "@/lib/equity";
import { handPercentile, topPercentRange } from "@/data/handRanking";
import {
  allHandKeys,
  comboCount,
  combosForKey,
  handKey,
  parseRange,
  rangeCombos,
  rangePercent,
} from "@/lib/ranges";
import { OPEN_RAISE, positionGroup } from "@/data/preflopRanges";

describe("hand keys and combos", () => {
  it("names hands the usual way", () => {
    const [as, ks, kh] = parseCards("As Ks Kh");
    expect(handKey(as, ks)).toBe("AKs");
    expect(handKey(as, kh)).toBe("AKo");
    expect(handKey(ks, kh)).toBe("KK");
  });

  it("covers all 169 starting hands and 1326 combos", () => {
    const keys = allHandKeys();
    expect(keys).toHaveLength(169);
    expect(keys.reduce((sum, key) => sum + comboCount(key), 0)).toBe(1326);
    expect(combosForKey("AA")).toHaveLength(6);
    expect(combosForKey("AKs")).toHaveLength(4);
    expect(combosForKey("AKo")).toHaveLength(12);
  });

  it("removes blocked combos", () => {
    const range = parseRange("AA");
    const blocked = parseCards("As");
    expect(rangeCombos(range, blocked)).toHaveLength(3);
  });
});

describe("range parsing", () => {
  it("expands pair and suited spans", () => {
    expect([...parseRange("JJ+").keys()]).toEqual(["JJ", "QQ", "KK", "AA"]);
    expect([...parseRange("TT-77").keys()]).toEqual(["77", "88", "99", "TT"]);
    expect([...parseRange("A9s+").keys()]).toEqual(["A9s", "ATs", "AJs", "AQs", "AKs"]);
    expect([...parseRange("KJo+").keys()]).toEqual(["KJo", "KQo"]);
  });

  it("expands a same-gap suited run", () => {
    expect([...parseRange("T9s-76s").keys()]).toEqual(["76s", "87s", "98s", "T9s"]);
  });

  it("parses a full range string", () => {
    const range = parseRange("77+, ATs+, KQs, AJo+");
    expect(range.has("AA")).toBe(true);
    expect(range.has("77")).toBe(true);
    expect(range.has("66")).toBe(false);
    expect(range.has("AJo")).toBe(true);
    expect(range.has("ATo")).toBe(false);
  });

  it("keeps the hero opening ranges tighter in early position than on the button", () => {
    const early = rangePercent(parseRange(OPEN_RAISE[positionGroup("UTG")]));
    const button = rangePercent(parseRange(OPEN_RAISE[positionGroup("BTN")]));
    expect(early).toBeLessThan(button);
    // Tighter than the 40-60% these opponents play, which is the whole point.
    expect(early).toBeLessThan(0.2);
    expect(button).toBeLessThan(0.55);
  });
});

describe("hand strength ordering", () => {
  it("puts the premium hands at the top", () => {
    expect(handPercentile("AA")).toBeLessThan(handPercentile("KK"));
    expect(handPercentile("KK")).toBeLessThan(handPercentile("AKs"));
    expect(handPercentile("AKs")).toBeLessThan(handPercentile("72o"));
    expect(handPercentile("72o")).toBeGreaterThan(0.95);
  });

  it("builds a range of roughly the requested size", () => {
    const range = topPercentRange(0.5);
    expect(rangePercent(range)).toBeGreaterThan(0.45);
    expect(rangePercent(range)).toBeLessThan(0.55);
  });
});

describe("equity estimates", () => {
  it("puts aces against a random hand near 85 percent", () => {
    const rng = makeRng(42);
    const result = equityVsRandom(parseCards("As Ac"), [], 1, rng, 4000);
    expect(result.equity).toBeGreaterThan(0.82);
    expect(result.equity).toBeLessThan(0.88);
  });

  it("drops aces toward a coin flip against five opponents", () => {
    const rng = makeRng(43);
    const result = equityVsRandom(parseCards("As Ac"), [], 5, rng, 4000);
    // Aces are still the favourite five handed, but barely a coin flip.
    expect(result.equity).toBeGreaterThan(0.42);
    expect(result.equity).toBeLessThan(0.56);
  });

  it("scores a flush draw against an overpair at roughly a third", () => {
    const rng = makeRng(44);
    const result = estimateEquity({
      hero: parseCards("Th 9h"),
      board: parseCards("Ah 7h 2c"),
      opponents: [parseRange("KK")],
      iterations: 4000,
      rng,
    });
    expect(result.equity).toBeGreaterThan(0.3);
    expect(result.equity).toBeLessThan(0.45);
  });

  it("knows the nuts are the nuts", () => {
    const rng = makeRng(45);
    const result = estimateEquity({
      hero: parseCards("As Ks"),
      board: parseCards("Qs Js Ts"),
      opponents: [parseRange("QQ, JJ, TT")],
      iterations: 1000,
      rng,
    });
    expect(result.equity).toBe(1);
  });

  it("reports equity against each opponent separately", () => {
    const rng = makeRng(46);
    const result = estimateEquity({
      hero: parseCards("As Ac"),
      board: [],
      opponents: [parseRange("KK"), parseRange("72o")],
      iterations: 2000,
      rng,
    });
    expect(result.perOpponent).toHaveLength(2);
    expect(result.perOpponent[0]).toBeLessThan(result.perOpponent[1]);
    expect(result.equity).toBeLessThan(result.perOpponent[0]);
  });
});
