import { PROFILE_MIX } from "@/data/profileTendencies";
import type { Rng } from "../cards";
import { callCost, limperCount } from "../betting";
import { type SessionSettings, startHand } from "../dealer";
import { type ActionInput, applyAction, isHandOver, potNow } from "../handEngine";
import { analyzeHand, tierRank } from "../handAnalysis";
import { chooseOpponentAction, pickProfile } from "../opponents/opponentAI";
import { readOpponent } from "../opponents/opponentRange";
import { isCallingStation, type ProfileId } from "../opponents/profiles";
import type { HandState } from "../types";
import type { PracticeModeId } from "./modes";

export interface SpotSetup {
  state: HandState;
  /**
   * True when the generator could not build the requested situation and dealt a
   * normal hand instead. The UI says so rather than pretending.
   */
  fallback: boolean;
  attempts: number;
}

const MAX_ATTEMPTS = 120;
const MAX_STEPS = 60;

/** Does the hero have a decision in front of them right now? */
function heroToAct(state: HandState): boolean {
  return (
    !isHandOver(state) &&
    state.actingSeat !== null &&
    state.players[state.actingSeat].isHero
  );
}

function playersInPot(state: HandState): number {
  return state.players.filter((p) => p.status !== "folded").length;
}

/**
 * How the hero plays the decisions *before* the drill spot: take a cheap look
 * and otherwise get out of the way. It only has to be plausible, since the
 * decision being drilled is the one it stops at.
 */
function filler(state: HandState): ActionInput {
  const seat = state.actingSeat as number;
  const player = state.players[seat];
  const toCall = callCost(state, seat);
  if (toCall === 0) return { type: "check" };
  const pot = potNow(state);
  const cheap = toCall <= Math.max(state.config.bigBlind * 3, pot * 0.25);
  return cheap && toCall < player.stack ? { type: "call" } : { type: "fold" };
}

type Predicate = (state: HandState) => boolean;

function predicateFor(mode: PracticeModeId): Predicate {
  switch (mode) {
    case "iso":
      return (state) =>
        state.street === "preflop" &&
        limperCount(state) >= 1 &&
        !state.history.some((a) => a.street === "preflop" && a.type === "raise");

    case "multiway":
      return (state) => state.street !== "preflop" && playersInPot(state) >= 3;

    case "thin-value":
      return (state) => {
        if (state.street === "preflop") return false;
        if (callCost(state, state.actingSeat as number) > 0) return false;
        const hero = state.players[state.config.heroSeat];
        const tier = tierRank(analyzeHand(hero.hole, state.board).tier);
        const middling =
          tier >= tierRank("marginal_pair") && tier <= tierRank("top_pair_weak_kicker");
        const stationIn = state.players.some(
          (p) => p.status !== "folded" && !p.isHero && isCallingStation(p.profile),
        );
        return middling && stationIn;
      };

    case "fold-to-aggression":
      return (state) => {
        if (state.street === "preflop") return false;
        const seat = state.actingSeat as number;
        if (callCost(state, seat) === 0) return false;
        const aggressorSeat = state.lastAggressor;
        if (aggressorSeat === null || aggressorSeat === seat) return false;
        const read = readOpponent(state, aggressorSeat);
        if (!read || !read.aggressionIsCredible) return false;
        const hero = state.players[state.config.heroSeat];
        const tier = tierRank(analyzeHand(hero.hole, state.board).tier);
        // A one-pair type hand: enough to be tempted, not enough to call.
        return tier >= tierRank("weak_pair") && tier <= tierRank("overpair");
      };

    case "draws":
      return (state) => {
        if (state.street !== "flop" && state.street !== "turn") return false;
        if (playersInPot(state) < 3) return false;
        const hero = state.players[state.config.heroSeat];
        const tier = analyzeHand(hero.hole, state.board).tier;
        return tier === "strong_draw" || tier === "weak_draw";
      };

    case "short-stack":
      return (state) => {
        if (state.street !== "preflop") return false;
        const hero = state.players[state.config.heroSeat];
        return (hero.stack + hero.committed) / state.config.bigBlind <= 15;
      };

    case "preflop":
      return (state) => state.street === "preflop";

    default:
      return () => true;
  }
}

/** Table composition that gives each drill a decent chance of coming up. */
function profilesFor(
  mode: PracticeModeId,
  tableSize: number,
  heroSeat: number,
  rng: Rng,
): ProfileId[] {
  const pick = (): ProfileId => pickProfile(rng, PROFILE_MIX) as ProfileId;

  return Array.from({ length: tableSize }, (_, seat) => {
    if (seat === heroSeat) return "hero";
    switch (mode) {
      case "thin-value":
        // Mostly players who call too much, which is what makes thin value work.
        return rng() < 0.75 ? "station" : pick();
      case "fold-to-aggression":
        // Only passive players, so their aggression carries the tell.
        return rng() < 0.5 ? "station" : "limper";
      case "iso":
        // Limpers, so there is something to isolate.
        return rng() < 0.6 ? "limper" : pick();
      default:
        return pick();
    }
  });
}

function stacksFor(
  mode: PracticeModeId,
  tableSize: number,
  heroSeat: number,
  settings: SessionSettings,
  rng: Rng,
): number[] | undefined {
  if (mode !== "short-stack") return undefined;
  // Six to fourteen big blinds: the range where it is shove or fold.
  const heroStack = Math.round((6 + rng() * 8) * settings.bigBlind);
  return Array.from({ length: tableSize }, (_, seat) =>
    seat === heroSeat ? heroStack : settings.startingStack,
  );
}

/**
 * Deal until the requested situation comes up, playing the hands that miss.
 *
 * Spot drills work by dealing real hands rather than hand-built positions, so
 * the stacks, ranges and action history are all consistent with a game that
 * actually happened.
 */
export function setupPractice(
  mode: PracticeModeId,
  rng: Rng,
  settings: SessionSettings,
): SpotSetup {
  const predicate = predicateFor(mode);
  const wantsSpot = mode !== "full";
  let firstState: HandState | null = null;

  for (let attempt = 1; attempt <= (wantsSpot ? MAX_ATTEMPTS : 1); attempt++) {
    const heroSeat = Math.floor(rng() * settings.tableSize);
    let state = startHand({
      rng,
      settings,
      heroSeat,
      profiles: profilesFor(mode, settings.tableSize, heroSeat, rng),
      stacks: stacksFor(mode, settings.tableSize, heroSeat, settings, rng),
    });

    if (!firstState) firstState = state;

    for (let step = 0; step < MAX_STEPS; step++) {
      if (isHandOver(state) || state.actingSeat === null) break;
      if (heroToAct(state)) {
        if (predicate(state)) return { state, fallback: false, attempts: attempt };
        // Not the spot we want: keep the hero in the hand cheaply and look again.
        state = applyAction(state, filler(state));
        continue;
      }
      state = applyAction(state, chooseOpponentAction(state, rng));
    }
  }

  // Could not build it. Deal a straightforward hand and say so.
  const heroSeat = Math.floor(rng() * settings.tableSize);
  const fallbackState =
    firstState ??
    startHand({
      rng,
      settings,
      heroSeat,
      profiles: profilesFor(mode, settings.tableSize, heroSeat, rng),
    });
  return { state: fallbackState, fallback: wantsSpot, attempts: MAX_ATTEMPTS };
}
