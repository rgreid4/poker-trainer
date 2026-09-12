import {
  CALL_VS_RAISE,
  CALL_VS_THREE_BET,
  FOUR_BET_VALUE,
  ISOLATE_LIMPERS,
  MULTIWAY_CALL_BONUS,
  OPEN_RAISE,
  type PositionGroup,
  SHOVE_RANGES,
  THREE_BET_LIGHT,
  THREE_BET_VALUE,
  positionGroup,
} from "@/data/preflopRanges";
import {
  CLOSE_SPOT_EPSILON,
  EQUITY_ITERATIONS,
  POSTFLOP,
  PREFLOP,
  SIZING_FIT_OVERSHOVE,
} from "@/data/thresholds";
import type { Rng } from "../cards";
import { callCost, legalActions, limperCount, potFraction, roundToChip } from "../betting";
import { type EquityResult, estimateEquity } from "../equity";
import { type HandAnalysis, analyzeHand, boardTexture, tierRank } from "../handAnalysis";
import { effectiveStack, potNow } from "../handEngine";
import { describeScore } from "../handRank";
import { evaluateHand } from "../evaluator";
import type { Cents } from "../money";
import { type OpponentRead, readOpponents } from "../opponents/opponentRange";
import { isCallingStation } from "../opponents/profiles";
import { type HandKey, type WeightedRange, handKey, parseRange, rangeContains } from "../ranges";
import { potOdds as potOddsOf, stackToPotRatio } from "../pot";
import type { Position } from "../table";
import type { HandState, LegalAction, SizingTag, Street } from "../types";
import type { ConceptId } from "./concepts";

export type ActionCategory = "fold" | "check" | "call" | "aggressive";

export interface ScoredAction {
  action: LegalAction;
  category: ActionCategory;
  /** 0 to 1, where 1 is the recommended play. */
  score: number;
  concept: ConceptId;
  reason: string;
  /** True when this play is specifically a loose-home-game adjustment. */
  houseAdjustment: boolean;
}

export interface Recommendation {
  seat: number;
  street: Street;
  scores: ScoredAction[];
  best: ScoredAction;
  /** True when two or more actions are close enough that either is fine. */
  close: boolean;
  /** Actions within the "just as good" band, including the best one. */
  alsoFine: ScoredAction[];
  equity: EquityResult;
  potOdds: number;
  pot: Cents;
  toCall: Cents;
  spr: number;
  handKey: HandKey;
  handLabel: string;
  analysis: HandAnalysis;
  opponents: OpponentRead[];
  playersInPot: number;
  inPosition: boolean;
  position: Position;
  /** The bet or raise total the engine would ideally make, when betting is the plan. */
  idealTo: Cents | null;
}

const rangeCache = new Map<string, WeightedRange>();

function cachedRange(text: string): WeightedRange {
  let range = rangeCache.get(text);
  if (!range) {
    range = parseRange(text);
    rangeCache.set(text, range);
  }
  return range;
}

function inRange(text: string, key: HandKey): boolean {
  if (!text) return false;
  return rangeContains(cachedRange(text), key);
}

interface Ctx {
  state: HandState;
  seat: number;
  street: Street;
  pot: Cents;
  toCall: Cents;
  potOdds: number;
  bigBlind: Cents;
  smallBlind: Cents;
  currentBet: Cents;
  effStack: Cents;
  stackBB: number;
  spr: number;
  facingBet: boolean;
  betRatio: number;
  equity: EquityResult;
  opponents: OpponentRead[];
  aggressor: OpponentRead | null;
  playersInPot: number;
  isMultiway: boolean;
  inPosition: boolean;
  position: Position;
  group: PositionGroup;
  handKey: HandKey;
  analysis: HandAnalysis;
  limpers: number;
  callers: number;
  raises: number;
  stationy: boolean;
  shortStack: boolean;
  texture: ReturnType<typeof boardTexture>;
}

interface Plan {
  fold: number;
  check: number;
  call: number;
  aggressive: number;
  concept: ConceptId;
  conceptByCategory?: Partial<Record<ActionCategory, ConceptId>>;
  reasons: Partial<Record<ActionCategory, string>>;
  houseAdjustment?: boolean;
  /** The bet or raise total this plan wants, if betting is on the menu. */
  idealTo?: Cents;
}

export interface RecommendOptions {
  state: HandState;
  rng: Rng;
  iterations?: number;
  /** Defaults to whoever is to act. */
  seat?: number;
}

/**
 * Work out what to do, why, and how much better it is than the alternatives.
 *
 * The numbers that come out of here are honest measurements: Monte Carlo equity
 * against modelled ranges, exact pot odds, exact SPR. The scores that rank the
 * actions are heuristics tuned for a loose home game, and the engine is candid
 * about that wherever a spot is close.
 */
export function recommend(options: RecommendOptions): Recommendation {
  const { state, rng } = options;
  const seat = options.seat ?? state.actingSeat;
  if (seat === null || seat === undefined) throw new Error("Nobody is to act");

  const player = state.players[seat];
  const ctx = buildContext(state, seat, rng, options.iterations);
  const plan = ctx.street === "preflop" ? preflopPlan(ctx) : postflopPlan(ctx);

  const legal = legalFor(state, seat);
  const scores: ScoredAction[] = legal.map((action) => {
    const category = categoryOf(action);
    let score = plan[category];
    if (category === "aggressive") score *= sizingFit(ctx, action, plan.idealTo);
    return {
      action,
      category,
      score: Math.max(0, Math.min(1, score)),
      concept: plan.conceptByCategory?.[category] ?? plan.concept,
      reason: plan.reasons[category] ?? "",
      houseAdjustment: Boolean(plan.houseAdjustment),
    };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  const runnerUp = scores[1];
  const close = Boolean(runnerUp && best.score - runnerUp.score <= CLOSE_SPOT_EPSILON);

  const handScore = state.board.length >= 3 ? evaluateHand(player.hole, state.board) : null;
  const handLabel =
    state.board.length >= 3 && handScore !== null
      ? `${describeScore(handScore)} — ${ctx.analysis.label}`
      : ctx.handKey;

  return {
    seat,
    street: ctx.street,
    scores,
    best,
    close,
    alsoFine: scores.filter((s) => best.score - s.score <= CLOSE_SPOT_EPSILON),
    equity: ctx.equity,
    potOdds: ctx.potOdds,
    pot: ctx.pot,
    toCall: ctx.toCall,
    spr: ctx.spr,
    handKey: ctx.handKey,
    handLabel,
    analysis: ctx.analysis,
    opponents: ctx.opponents,
    playersInPot: ctx.playersInPot,
    inPosition: ctx.inPosition,
    position: ctx.position,
    idealTo: plan.idealTo ?? null,
  };
}

function legalFor(state: HandState, seat: number): LegalAction[] {
  if (state.actingSeat === seat) return legalActions(state);
  // Drills sometimes ask for a recommendation for a seat that is not strictly
  // to act; pretend it is their turn so the option list still makes sense.
  return legalActions({ ...state, actingSeat: seat });
}

function categoryOf(action: LegalAction): ActionCategory {
  switch (action.type) {
    case "fold":
      return "fold";
    case "check":
      return "check";
    case "call":
      return "call";
    default:
      return "aggressive";
  }
}

function buildContext(state: HandState, seat: number, rng: Rng, iterations?: number): Ctx {
  const player = state.players[seat];
  const pot = potNow(state);
  const toCall = callCost(state, seat);
  const opponents = readOpponents(state, seat);
  const analysis = analyzeHand(player.hole, state.board);

  const equity = estimateEquity({
    hero: player.hole,
    board: state.board,
    opponents: opponents.map((o) => o.range),
    iterations: iterations ?? EQUITY_ITERATIONS.full,
    rng,
  });

  const effStack = effectiveStack(state, seat);
  const aggressorSeat = state.lastAggressor;
  const aggressor =
    aggressorSeat !== null && aggressorSeat !== seat
      ? opponents.find((o) => o.seat === aggressorSeat) ?? null
      : null;

  const playersInPot = state.players.filter((p) => p.status !== "folded").length;
  const raises = state.history.filter(
    (a) => a.street === state.street && (a.type === "raise" || (a.type === "bet" && state.street === "preflop")),
  ).length;

  // In position means nobody left to act behind us on later streets.
  const postflopSeats = state.players
    .filter((p) => p.status === "active" || p.status === "allin")
    .map((p) => p.seat);
  const buttonRelative = (s: number) =>
    (s - state.config.buttonSeat + state.config.tableSize) % state.config.tableSize;
  const inPosition = postflopSeats.every(
    (s) => s === seat || buttonRelative(s) < buttonRelative(seat),
  );

  return {
    state,
    seat,
    street: state.street,
    pot,
    toCall,
    potOdds: potOddsOf(pot, toCall),
    bigBlind: state.config.bigBlind,
    smallBlind: state.config.smallBlind,
    currentBet: state.currentBet,
    effStack,
    stackBB: (player.stack + player.committed) / state.config.bigBlind,
    spr: stackToPotRatio(effStack, pot),
    facingBet: toCall > 0,
    betRatio: pot > 0 ? potFraction(toCall, pot - toCall > 0 ? pot - toCall : pot) : 0,
    equity,
    opponents,
    aggressor,
    playersInPot,
    isMultiway: playersInPot >= POSTFLOP.multiwayPlayers,
    inPosition,
    position: state.positions[seat],
    group: positionGroup(state.positions[seat]),
    handKey: handKey(player.hole[0], player.hole[1]),
    analysis,
    limpers: limperCount(state),
    callers: state.history.filter((a) => a.street === state.street && a.type === "call").length,
    raises,
    stationy: opponents.some((o) => isCallingStation(o.profile.id)),
    shortStack: (player.stack + player.committed) / state.config.bigBlind <= PREFLOP.shortStackBB,
    texture: boardTexture(state.board),
  };
}

/** How well a bet or raise size matches the plan. */
function sizingFit(ctx: Ctx, action: LegalAction, idealTo?: Cents): number {
  if (idealTo === undefined) return action.allIn ? SIZING_FIT_OVERSHOVE : 0.9;

  if (action.allIn) {
    const committed = ctx.spr <= POSTFLOP.commitSPR || ctx.shortStack;
    if (committed) return 1;
    return action.to <= idealTo * 1.25 ? 0.95 : SIZING_FIT_OVERSHOVE;
  }

  const distance = Math.abs(action.to - idealTo) / Math.max(idealTo, ctx.bigBlind);
  return Math.max(0.55, Math.min(1, 1 - distance * 0.85));
}

function opponentNames(reads: OpponentRead[]): string {
  const names = reads.map((r) => r.profile.name.toLowerCase());
  if (names.length === 0) return "your opponent";
  if (names.length === 1) return `a ${names[0]}`;
  return `${names.length} loose players`;
}

// ---------------------------------------------------------------- preflop ----

function preflopPlan(ctx: Ctx): Plan {
  const key = ctx.handKey;
  const group = ctx.group;
  const shove = shovePlan(ctx);

  if (ctx.raises === 0) {
    return ctx.limpers > 0 ? limpedPotPlan(ctx, shove) : unopenedPlan(ctx, shove);
  }
  if (ctx.raises === 1) return facingRaisePlan(ctx, shove);

  // Facing a 3-bet or more: value only.
  if (inRange(FOUR_BET_VALUE, key)) {
    return {
      fold: 0.05,
      check: 0.1,
      call: 0.7,
      aggressive: 1,
      concept: "three-bet-value",
      idealTo: roundToChip(ctx.currentBet * 2.4, ctx.smallBlind),
      reasons: {
        aggressive: "This is far too strong to just call a re-raise with.",
        call: "Calling keeps the pot smaller than this hand deserves.",
        fold: "Folding one of the best hands in poker gives up a huge edge.",
      },
    };
  }
  if (inRange(CALL_VS_THREE_BET[group], key)) {
    return {
      fold: 0.4,
      check: 0.1,
      call: 1,
      aggressive: 0.45,
      concept: "three-bet-value",
      reasons: {
        call: "Strong enough to see a flop against a re-raise, not strong enough to raise again.",
        fold: "A little tight, though folding here is rarely a disaster.",
        aggressive: "Raising again turns a good hand into a bluff-catcher for a huge pot.",
      },
    };
  }
  return {
    fold: 1,
    check: 0.2,
    call: 0.25,
    aggressive: 0.1,
    concept: "fold-preflop",
    reasons: {
      fold: "A re-raise in this game means a real hand. Let it go.",
      call: "Calling a re-raise with this is how big losing sessions start.",
      aggressive: "There is no bluffing your way through someone who woke up with a hand.",
    },
  };
}

function shovePlan(ctx: Ctx): Plan | null {
  if (!ctx.shortStack) return null;
  const band = SHOVE_RANGES.find((entry) => ctx.stackBB <= entry.maxBB);
  if (!band || !inRange(band.range, ctx.handKey)) return null;
  return {
    fold: 0.15,
    check: 0.2,
    call: 0.55,
    aggressive: 1,
    concept: "short-stack-shove",
    idealTo: ctx.state.players[ctx.seat].committed + ctx.state.players[ctx.seat].stack,
    reasons: {
      aggressive: `With ${ctx.stackBB.toFixed(0)} big blinds behind there is no room to play after the flop, so get it in while you have the best of it.`,
      call: "Calling leaves you committed with no way to win the pot without hitting.",
      fold: "This hand is too good to fold at this stack depth.",
    },
  };
}

function unopenedPlan(ctx: Ctx, shove: Plan | null): Plan {
  const key = ctx.handKey;
  if (shove) return shove;

  const openIdeal = roundToChip(
    3 * ctx.bigBlind * (ctx.stationy ? 1.15 : 1),
    ctx.smallBlind,
  );

  if (inRange(OPEN_RAISE[ctx.group], key)) {
    return {
      fold: 0.08,
      check: 0.2,
      call: 0.4,
      aggressive: 1,
      concept: "raise-dont-limp",
      idealTo: openIdeal,
      houseAdjustment: false,
      reasons: {
        aggressive: `Open for a raise from ${ctx.position}. Taking the lead is worth far more than seeing a cheap flop in a five-way pot.`,
        call: "Limping invites the whole table in and gives up the initiative with a hand that wants to play a raised pot.",
        check: "Checking gives up the chance to take the pot down or build one with the best hand.",
        fold: "This hand is a profitable open from this seat.",
      },
    };
  }

  return {
    fold: 1,
    check: 1,
    call: 0.25,
    aggressive: 0.2,
    concept: "fold-preflop",
    reasons: {
      fold: `${key} is below a profitable opening range from ${ctx.position}. Most of your edge in this game comes from folding the hands your opponents play.`,
      check: "Taking a free look is fine when you are already in for nothing.",
      call: ctx.inPosition
        ? "Limping in with a weak hand invites the blinds along and leaves you playing junk in a multiway pot."
        : "Paying to play a weak hand out of position into a loose field is a slow leak.",
      aggressive: "Opening this hand from this seat builds a pot with the worst of it.",
    },
  };
}

function limpedPotPlan(ctx: Ctx, shove: Plan | null): Plan {
  const key = ctx.handKey;
  if (shove) return shove;

  // Isolation raises go bigger than a normal open: one extra big blind per
  // limper, and bigger still when the limpers cannot fold.
  const isoIdeal = roundToChip(
    (3 * ctx.bigBlind + ctx.limpers * ctx.bigBlind) * (ctx.stationy ? 1.3 : 1.1),
    ctx.smallBlind,
  );

  if (inRange(ISOLATE_LIMPERS[ctx.group], key)) {
    return {
      fold: 0.08,
      check: 0.15,
      call: 0.45,
      aggressive: 1,
      concept: "isolate-limpers",
      houseAdjustment: true,
      idealTo: isoIdeal,
      reasons: {
        aggressive: `Raise big over the ${ctx.limpers === 1 ? "limper" : `${ctx.limpers} limpers`}. They call anyway, so this is a value bet that also buys you the lead in the hand.`,
        call: "Limping along behind them wastes the best hand at the table and keeps the field wide.",
        check: "Checking here passes up a clear value raise.",
        fold: "This is well ahead of a limping range.",
      },
    };
  }

  const speculative =
    inRange(MULTIWAY_CALL_BONUS, key) &&
    ctx.toCall <= PREFLOP.maxSpeculativeCallBB * ctx.bigBlind &&
    (ctx.inPosition || ctx.limpers >= 2);

  if (speculative) {
    return {
      fold: 0.6,
      check: 0.5,
      call: 0.95,
      aggressive: 0.35,
      concept: "multiway-caution",
      reasons: {
        call: `Cheap and multiway is exactly when ${key} is worth playing: it wants company and a small price, and these players pay you off when it connects.`,
        fold: "Folding is perfectly fine; this is a small-edge call, not a must-play.",
        aggressive: "Raising turns an implied-odds hand into a bloated pot with a hand that flops well but rarely dominates.",
        check: "Taking the free card is fine.",
      },
    };
  }

  return {
    fold: 1,
    check: 0.9,
    call: 0.3,
    aggressive: 0.15,
    concept: "fold-preflop",
    reasons: {
      fold: `${key} plays badly in a multiway limped pot. Weak aces and offsuit junk make second-best hands, which is how you lose money here.`,
      call: "Cheap is not the same as profitable. This hand flops a lot of trouble.",
      aggressive: "Raising this hand into a field of callers builds a pot you will not know how to play.",
      check: "A free look is fine.",
    },
  };
}

function facingRaisePlan(ctx: Ctx, shove: Plan | null): Plan {
  const key = ctx.handKey;
  const group = ctx.group;
  if (shove) return shove;

  const raiser = ctx.aggressor;
  const raiserName = raiser ? raiser.profile.name.toLowerCase() : "the raiser";
  const raiserIsPassive = raiser ? isCallingStation(raiser.profile.id) : false;
  const raiserWidth = raiser?.width ?? 0.2;
  const threeBetIdeal = roundToChip(
    ctx.currentBet * 3 + ctx.callers * ctx.bigBlind,
    ctx.smallBlind,
  );

  if (inRange(THREE_BET_VALUE[group], key)) {
    return {
      fold: 0.04,
      check: 0.1,
      call: 0.62,
      aggressive: 1,
      concept: "three-bet-value",
      houseAdjustment: true,
      idealTo: threeBetIdeal,
      reasons: {
        aggressive: `3-bet for value. ${raiserIsPassive ? "A passive player who raised will call a 3-bet with worse" : "This is ahead of the raising range"}, and you want the money in while you are in front.`,
        call: "Calling is fine but leaves value on the table and lets the blinds in behind you.",
        fold: "This is one of the strongest hands you can have. Folding is out of the question.",
      },
    };
  }

  if (
    inRange(THREE_BET_LIGHT[group], key) &&
    raiser &&
    raiser.profile.tendencies.foldToThreeBet >= PREFLOP.minFoldToThreeBet
  ) {
    return {
      fold: 0.45,
      check: 0.1,
      call: 0.6,
      aggressive: 0.85,
      concept: "three-bet-value",
      idealTo: threeBetIdeal,
      reasons: {
        aggressive: `A light 3-bet works against ${raiserName}, who folds to pressure often enough to make it pay. Keep this list short in a game full of callers.`,
        call: "Calling is the lower-variance option and plays fine in position.",
        fold: "Folding is defensible; this is a thin spot either way.",
      },
    };
  }

  // A passive player's raise is a genuine hand, so the calling range has to be
  // much tighter than it would be against a normal opponent.
  const dominated = raiserIsPassive && raiserWidth < 0.12;

  if (inRange(CALL_VS_RAISE[group], key) && !dominated) {
    return {
      fold: 0.35,
      check: 0.1,
      call: 1,
      aggressive: 0.5,
      concept: ctx.inPosition ? "position" : "pot-odds",
      reasons: {
        call: `Good enough to see a flop against ${opponentNames(ctx.opponents)}${ctx.inPosition ? " with position on them" : ""}, especially with more callers likely to come along.`,
        fold: "Folding is a touch tight but never terrible out of position.",
        aggressive: "Raising this turns a comfortable call into a bloated pot with a hand that does not want one.",
      },
    };
  }

  if (dominated && inRange(CALL_VS_RAISE[group], key)) {
    return {
      fold: 1,
      check: 0.1,
      call: 0.55,
      aggressive: 0.2,
      concept: "respect-passive-aggression",
      houseAdjustment: true,
      idealTo: threeBetIdeal,
      reasons: {
        fold: `${raiserName === "calling station" ? "A calling station" : "A loose-passive player"} who raises preflop has a real hand — roughly the top ${Math.max(1, Math.round(raiserWidth * 100))}% here. ${key} is usually dominated, so fold now rather than flop a second-best pair.`,
        call: "Against a normal opponent this would be an easy call. Against this one it is not.",
        aggressive: "Raising into the one range that has you beaten is the worst of the three options.",
      },
    };
  }

  return {
    fold: 1,
    check: 0.15,
    call: 0.28,
    aggressive: 0.12,
    concept: "fold-preflop",
    reasons: {
      fold: `${key} is not strong enough to call a raise from ${ctx.position}. Folding costs nothing and keeps you out of trouble.`,
      call: "Calling raises with weak hands out of position is the biggest leak in a loose game.",
      aggressive: "There is no value and little fold equity here.",
    },
  };
}

// --------------------------------------------------------------- postflop ----

function postflopPlan(ctx: Ctx): Plan {
  return ctx.facingBet ? facingBetPlan(ctx) : noBetPlan(ctx);
}

/** Fraction of the pot to bet, given who is in the hand. */
function valueFraction(ctx: Ctx): number {
  if (ctx.stationy) return 1;
  if (ctx.isMultiway && ctx.texture.wetness > 0.5) return 1;
  return 0.75;
}

function idealBet(ctx: Ctx, fraction: number): Cents {
  const potAfterCall = ctx.pot + ctx.toCall;
  return roundToChip(ctx.currentBet + fraction * potAfterCall, ctx.smallBlind);
}

function impliedOdds(ctx: Ctx): number {
  return (
    POSTFLOP.impliedOddsBonus +
    POSTFLOP.impliedOddsPerOpponent * Math.max(0, ctx.playersInPot - 2) +
    (ctx.stationy ? POSTFLOP.impliedOddsVsStation : 0)
  );
}

function facingBetPlan(ctx: Ctx): Plan {
  const tier = tierRank(ctx.analysis.tier);
  // A draw ranks above a weak pair on the tier ladder, so draws have to be
  // pulled out before the made-pair branches or they get treated as pairs.
  const isDraw = ctx.analysis.tier === "strong_draw" || ctx.analysis.tier === "weak_draw";
  const credible = ctx.aggressor?.aggressionIsCredible ?? false;
  const aggressorName = ctx.aggressor?.profile.name.toLowerCase() ?? "your opponent";
  const equity = ctx.equity.equity;
  const raiseIdeal = idealBet(ctx, valueFraction(ctx));

  const numbers = `You have about ${Math.round(equity * 100)}% equity and the call needs ${Math.round(ctx.potOdds * 100)}%.`;

  if (tier >= tierRank("two_pair")) {
    if (credible && tier < tierRank("strong")) {
      return {
        fold: 0.35,
        check: 0,
        call: 1,
        aggressive: 0.6,
        concept: "respect-passive-aggression",
        houseAdjustment: true,
        idealTo: raiseIdeal,
        reasons: {
          call: `Two pair is strong, but a ${aggressorName} who raises usually has a set or better. Call and see what happens rather than building a pot against the top of their range.`,
          aggressive: "Raising is not terrible, but it gets you married to a hand that is often second best when this player gets aggressive.",
          fold: "Too strong to fold to one raise.",
        },
      };
    }
    return {
      fold: 0.03,
      check: 0,
      call: 0.7,
      aggressive: 1,
      concept: "dont-slow-play",
      houseAdjustment: true,
      idealTo: raiseIdeal,
      reasons: {
        aggressive: `Raise. ${ctx.stationy ? "These players call raises with worse hands and draws, so there is no reason to be subtle" : "Get the money in while you are well ahead"}. ${numbers}`,
        call: "Calling keeps the pot small with a hand that wants a big one and lets draws in cheaply.",
        fold: "Folding a hand this strong to a single bet is a serious error.",
      },
    };
  }

  if (tier >= tierRank("top_pair_good_kicker")) {
    if (credible) {
      return {
        fold: 1,
        check: 0,
        call: 0.5,
        aggressive: 0.12,
        concept: "respect-passive-aggression",
        houseAdjustment: true,
        reasons: {
          fold: `A ${aggressorName} who suddenly ${ctx.aggressor?.read === "raised" ? "raises" : "fires a big bet"} almost never has a bluff. Top pair is a bluff-catcher against a range that has you beaten, so fold.`,
          call: "Calling once is understandable, but this player does not have air here often enough.",
          aggressive: "Raising into a range full of two pair and sets is the worst option available.",
        },
      };
    }
    if (ctx.betRatio <= POSTFLOP.smallBetRatio && ctx.stationy) {
      return {
        fold: 0.1,
        check: 0,
        call: 0.8,
        aggressive: 1,
        concept: "value-bet-bigger",
        houseAdjustment: true,
        idealTo: raiseIdeal,
        reasons: {
          aggressive: `That small bet is usually a weak made hand or a draw. Raise it: ${aggressorName === "calling station" ? "a station" : "this player"} will call with worse and you charge the draws at the same time. ${numbers}`,
          call: "Calling is fine but leaves money behind against someone who pays off raises.",
          fold: "Far too strong to fold to a small bet.",
        },
      };
    }
    return {
      fold: 0.15,
      check: 0,
      call: 1,
      aggressive: 0.6,
      concept: "pot-odds",
      reasons: {
        call: `Top pair is comfortably ahead of the betting range here. ${numbers}`,
        aggressive: "Raising is reasonable for value, though it can turn a good hand into a big pot against the part of their range that beats you.",
        fold: "Folding top pair to one bet gives up too much.",
      },
    };
  }

  if (tier >= tierRank("weak_pair") && !isDraw) {
    if (credible) {
      return {
        fold: 1,
        check: 0,
        call: 0.32,
        aggressive: 0.08,
        concept: "respect-passive-aggression",
        houseAdjustment: true,
        reasons: {
          fold: `You have ${ctx.analysis.label}, which is not a hand that calls a raise from a ${aggressorName}. Their aggression means a real hand, and yours is not one.`,
          call: "This is exactly the hand that loses a stack calling down against a passive player who woke up.",
          aggressive: "Bluff-raising a player who does not fold is the worst option here.",
        },
      };
    }
    if (equity > ctx.potOdds + POSTFLOP.callMargin) {
      return {
        fold: 0.3,
        check: 0,
        call: 1,
        aggressive: 0.25,
        concept: "pot-odds",
        reasons: {
          call: `The price is right: ${numbers}`,
          fold: "Folding is a little tight given the price.",
          aggressive: "Raising a medium hand here bloats the pot and folds out nothing.",
        },
      };
    }
    return {
      fold: 1,
      check: 0,
      call: 0.45,
      aggressive: 0.12,
      concept: "pot-odds",
      reasons: {
        fold: `The price is wrong. ${numbers}`,
        call: "Calling with a weak pair at a bad price is a steady leak.",
        aggressive: "No value and no fold equity.",
      },
    };
  }

  if (isDraw) {
    const implied = impliedOdds(ctx);
    const effective = equity + implied;
    const drawNumbers = `${numbers} Counting the extra money you win when you hit against players who cannot fold, you are effectively around ${Math.round(effective * 100)}%.`;
    if (effective > ctx.potOdds + POSTFLOP.callMargin) {
      return {
        fold: 0.25,
        check: 0,
        call: 1,
        aggressive: ctx.stationy ? 0.32 : 0.6,
        concept: "draws-need-a-price",
        idealTo: idealBet(ctx, 0.75),
        reasons: {
          call: `Call and draw. ${drawNumbers}`,
          aggressive: ctx.stationy
            ? "Semi-bluff raising needs fold equity, and there is almost none against players who call everything. Just call and try to hit."
            : "Raising as a semi-bluff is a reasonable alternative with this much equity.",
          fold: "Folding a draw with a price this good gives up a profitable spot.",
        },
      };
    }
    return {
      fold: 1,
      check: 0,
      call: 0.38,
      aggressive: 0.12,
      concept: "draws-need-a-price",
      reasons: {
        fold: `Not enough. ${drawNumbers}`,
        call: "Chasing at the wrong price is the single most common leak in this game — do not copy your opponents.",
        aggressive: "A raise here is a bluff against players who do not fold.",
      },
    };
  }

  // No pair and nothing to draw to. Folding is nearly always right, but a tiny
  // bet into a big pot can still be worth calling with a little showdown value,
  // so the price gets checked rather than ignored.
  const priceIsCheap = equity > ctx.potOdds + POSTFLOP.callMargin;

  return {
    fold: priceIsCheap ? 0.55 : 1,
    check: 0,
    call: priceIsCheap ? 1 : 0.15,
    aggressive: ctx.stationy ? 0.04 : 0.12,
    concept: "pot-odds",
    conceptByCategory: { aggressive: "dont-bluff-stations" },
    houseAdjustment: true,
    reasons: {
      fold: priceIsCheap
        ? `Folding is fine and simple, though the bet is small enough that a call is not a mistake. ${numbers}`
        : `You have ${ctx.analysis.label}. Fold and keep your money for the spots where you actually have a hand. ${numbers}`,
      call: priceIsCheap
        ? `The bet is small enough that even this hand has the equity to call. ${numbers}`
        : "Calling with no pair and no draw hoping to improve is pure donation.",
      aggressive: ctx.stationy
        ? "Bluff-raising a calling station is the most expensive mistake available in this game. They call with any pair, any draw, and often less."
        : "A bluff-raise here needs a lot to go right.",
    },
  };
}

function noBetPlan(ctx: Ctx): Plan {
  const tier = tierRank(ctx.analysis.tier);
  const fraction = valueFraction(ctx);
  const betIdeal = idealBet(ctx, fraction);
  const sizeWords = fraction >= 1 ? "a pot-sized bet" : "about three quarters of the pot";
  const equity = ctx.equity.equity;
  const numbers = `You have about ${Math.round(equity * 100)}% equity against ${ctx.playersInPot - 1 === 1 ? "their range" : "their ranges"}.`;

  if (tier >= tierRank("two_pair")) {
    return {
      fold: 0,
      check: 0.3,
      call: 0,
      aggressive: 1,
      concept: "dont-slow-play",
      houseAdjustment: true,
      idealTo: betIdeal,
      reasons: {
        aggressive: `Bet, and bet big — ${sizeWords}. Slow-playing only works against opponents who bet for you, and these players will happily call instead. ${numbers}`,
        check: "Checking a big hand here gives free cards to every draw and wins a small pot at best.",
      },
    };
  }

  if (tier >= tierRank("top_pair_good_kicker")) {
    const chargingDraws = ctx.isMultiway && ctx.texture.wetness > 0.45;
    return {
      fold: 0,
      check: 0.4,
      call: 0,
      aggressive: 1,
      concept: chargingDraws ? "charge-draws" : "value-bet-bigger",
      houseAdjustment: true,
      idealTo: betIdeal,
      reasons: {
        aggressive: chargingDraws
          ? `Bet ${sizeWords}. With this many players on a board this coordinated, someone is drawing, and they will chase at any price — so make the price high. ${numbers}`
          : `Bet ${sizeWords}. ${ctx.stationy ? "Players who call too much do not fold to big bets, so size up rather than down" : "Get value while you are ahead"}. ${numbers}`,
        check: "Checking top pair to keep the pot small is a habit from tougher games. Here it just misses value.",
      },
    };
  }

  if (tier >= tierRank("top_pair_weak_kicker")) {
    if (ctx.isMultiway) {
      return {
        fold: 0,
        check: 0.85,
        call: 0,
        aggressive: 0.9,
        concept: "multiway-caution",
        idealTo: idealBet(ctx, 0.6),
        reasons: {
          aggressive: "A bet gets called by worse, but with this many players a weak kicker is often second best. This is a close spot.",
          check: "Checking keeps the pot manageable with a hand that does not want a raise multiway. Close either way.",
        },
      };
    }
    return {
      fold: 0,
      check: 0.6,
      call: 0,
      aggressive: 1,
      concept: "thin-value",
      houseAdjustment: true,
      idealTo: idealBet(ctx, 0.6),
      reasons: {
        aggressive: `Bet it. Top pair with a weak kicker is a hand you would check against good players, but ${opponentNames(ctx.opponents)} will call with second pair, ace high and draws. ${numbers}`,
        check: "Checking is safe but passes up a bet that gets called by plenty of worse hands.",
      },
    };
  }

  if (tier >= tierRank("marginal_pair")) {
    if (ctx.stationy && !ctx.isMultiway) {
      return {
        fold: 0,
        check: 0.8,
        call: 0,
        aggressive: 1,
        concept: "thin-value",
        houseAdjustment: true,
        idealTo: idealBet(ctx, 0.5),
        reasons: {
          aggressive: `A small bet gets called by ace high and worse pairs. Against a calling station that is real value, even with a middling pair. ${numbers}`,
          check: "Checking is fine and keeps the pot small, but it leaves a thin bet on the table.",
        },
      };
    }
    return {
      fold: 0,
      check: 1,
      call: 0,
      aggressive: 0.6,
      concept: "pot-control",
      idealTo: idealBet(ctx, 0.5),
      reasons: {
        check: `A middling pair does not want to build a pot or face a raise. Check and try to get to showdown. ${numbers}`,
        aggressive: "Betting is not crazy for thin value, but multiway it invites raises you cannot call.",
      },
    };
  }

  if (ctx.analysis.tier === "strong_draw") {
    if (ctx.isMultiway) {
      return {
        fold: 0,
        check: 1,
        call: 0,
        aggressive: 0.6,
        concept: "multiway-caution",
        idealTo: idealBet(ctx, 0.6),
        reasons: {
          check: `Take the free card. With ${ctx.playersInPot - 1} players still in, a semi-bluff folds nobody out and you can see the turn for nothing. ${numbers}`,
          aggressive: "Betting a draw multiway builds a pot without fold equity, though it does set up a bigger payday when you hit.",
        },
      };
    }
    return {
      fold: 0,
      check: 0.75,
      call: 0,
      aggressive: 1,
      concept: "charge-draws",
      idealTo: idealBet(ctx, 0.75),
      reasons: {
        aggressive: `Bet the draw. Heads up you win the pot outright some of the time, and you have a lot of equity when called. ${numbers}`,
        check: "Checking to see a free card is reasonable, especially out of position.",
      },
    };
  }

  return {
    fold: 0,
    check: 1,
    call: 0,
    aggressive: ctx.stationy ? 0.08 : 0.2,
    concept: "dont-bluff-stations",
    houseAdjustment: true,
    idealTo: idealBet(ctx, 0.6),
    reasons: {
      check: `Check. ${ctx.analysis.label} against ${opponentNames(ctx.opponents)} has no value and no fold equity — give up cheaply and wait for a hand.`,
      aggressive: ctx.stationy
        ? "A bluff needs someone who folds. A calling station calls with any pair, any draw and often ace high, so this bet simply loses money."
        : "Bluffing here needs more fold equity than this board and these players offer.",
    },
  };
}
