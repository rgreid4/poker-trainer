import { OPPONENT_NAMES, PROFILE_MIX } from "@/data/profileTendencies";
import type { Rng } from "./cards";
import { applyAction, createHand, isHandOver } from "./handEngine";
import { chooseOpponentAction, pickProfile } from "./opponents/opponentAI";
import type { ProfileId } from "./opponents/profiles";
import type { Cents } from "./money";
import { MAX_PLAYERS, MIN_PLAYERS } from "./table";
import type { HandState, TableConfig } from "./types";

export interface SessionSettings {
  tableSize: number;
  smallBlind: Cents;
  bigBlind: Cents;
  startingStack: Cents;
}

export const DEFAULT_SETTINGS: SessionSettings = {
  tableSize: 6,
  smallBlind: 25,
  bigBlind: 50,
  startingStack: 2500, // $25 = 50 big blinds
};

export interface StartHandOptions {
  settings?: Partial<SessionSettings>;
  rng: Rng;
  /** Fix the hero seat and button; otherwise both are random each hand. */
  heroSeat?: number;
  buttonSeat?: number;
  profiles?: ProfileId[];
  stacks?: Cents[];
}

export function startHand(options: StartHandOptions): HandState {
  const settings = { ...DEFAULT_SETTINGS, ...options.settings };
  const tableSize = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, settings.tableSize));
  const { rng } = options;

  const heroSeat = options.heroSeat ?? Math.floor(rng() * tableSize);
  // Rotating the button rather than the hero seat is what randomises the
  // hero's position from hand to hand.
  const buttonSeat = options.buttonSeat ?? Math.floor(rng() * tableSize);

  const profiles: ProfileId[] =
    options.profiles ??
    Array.from({ length: tableSize }, (_, seat) =>
      seat === heroSeat ? "hero" : (pickProfile(rng, PROFILE_MIX) as ProfileId),
    );

  const names = buildNames(tableSize, heroSeat, rng);

  const config: TableConfig = {
    tableSize,
    smallBlind: settings.smallBlind,
    bigBlind: settings.bigBlind,
    startingStack: settings.startingStack,
    heroSeat,
    buttonSeat,
  };

  return createHand({ config, rng, profiles, names, stacks: options.stacks });
}

function buildNames(tableSize: number, heroSeat: number, rng: Rng): string[] {
  const pool = [...OPPONENT_NAMES];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  let next = 0;
  return Array.from({ length: tableSize }, (_, seat) =>
    seat === heroSeat ? "You" : (pool[next++] ?? `Player ${seat + 1}`),
  );
}

/**
 * Play out opponent decisions until it is the hero's turn or the hand is over.
 * Returns the new state plus how many opponent actions were taken, which the UI
 * uses to pace its animations.
 */
export function advanceToHero(state: HandState, rng: Rng, maxSteps = 200): HandState {
  let current = state;
  let steps = 0;
  while (!isHandOver(current) && current.actingSeat !== null && steps < maxSteps) {
    const seat = current.actingSeat;
    if (current.players[seat].isHero) break;
    current = applyAction(current, chooseOpponentAction(current, rng));
    steps += 1;
  }
  return current;
}

/** One opponent decision, for step-by-step UI playback. */
export function stepOpponent(state: HandState, rng: Rng): HandState {
  if (isHandOver(state) || state.actingSeat === null) return state;
  if (state.players[state.actingSeat].isHero) return state;
  return applyAction(state, chooseOpponentAction(state, rng));
}

/** Play a whole hand with the hero also driven by a callback. For tests and drills. */
export function playOutHand(
  state: HandState,
  rng: Rng,
  heroDecision: (state: HandState) => Parameters<typeof applyAction>[1],
  maxSteps = 400,
): HandState {
  let current = state;
  let steps = 0;
  while (!isHandOver(current) && current.actingSeat !== null && steps < maxSteps) {
    const seat = current.actingSeat;
    current = current.players[seat].isHero
      ? applyAction(current, heroDecision(current))
      : applyAction(current, chooseOpponentAction(current, rng));
    steps += 1;
  }
  return current;
}
