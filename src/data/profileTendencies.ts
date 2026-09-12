import type { OpponentProfile, ProfileId } from "@/lib/opponents/profiles";

/**
 * TUNING FILE. These numbers describe how the simulated home-game opponents
 * actually play. Nothing here is solver output; it is a description of the
 * recreational players this trainer is built to beat. Edit freely.
 *
 * Rules of thumb baked into the defaults:
 *  - Everyone except the tight player is too loose preflop and calls too much.
 *  - Bluffing is rare, so a big bet or a raise usually means a real hand.
 *  - Nobody folds top pair easily, which is why thin value betting prints.
 */
export const PROFILES: Record<Exclude<ProfileId, "hero">, OpponentProfile> = {
  station: {
    id: "station",
    name: "Calling station",
    badge: "STA",
    icon: "📞",
    blurb: "Calls far too often, almost never bluffs, and will pay off top pair.",
    badgeClass: "bg-sky-500/20 text-sky-200 ring-sky-400/40",
    tendencies: {
      vpip: 0.55,
      openRaise: 0.18,
      callRaise: 0.4,
      threeBet: 0.02,
      foldToThreeBet: 0.35,
      cbet: 0.35,
      bluffFreq: 0.04,
      thinValue: 0.35,
      callAnyPair: 0.92,
      callDraw: 0.88,
      callOvercards: 0.45,
      foldTopPair: 0.08,
      raiseStrong: 0.45,
      donk: 0.2,
      blockBet: 0.3,
      sizingBias: 0.8,
    },
  },
  limper: {
    id: "limper",
    name: "Loose-passive limper",
    badge: "LIM",
    icon: "🪑",
    blurb: "Limps in with anything playable, calls raises wide, rarely takes the lead.",
    badgeClass: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
    tendencies: {
      vpip: 0.5,
      openRaise: 0.1,
      callRaise: 0.34,
      threeBet: 0.015,
      foldToThreeBet: 0.45,
      cbet: 0.28,
      bluffFreq: 0.05,
      thinValue: 0.3,
      callAnyPair: 0.85,
      callDraw: 0.8,
      callOvercards: 0.35,
      foldTopPair: 0.12,
      raiseStrong: 0.5,
      donk: 0.25,
      blockBet: 0.35,
      sizingBias: 0.7,
    },
  },
  maniac: {
    id: "maniac",
    name: "Maniac",
    badge: "MAN",
    icon: "🔥",
    blurb: "Raises and bluffs far too much. Pay them off lighter, and trap more.",
    badgeClass: "bg-rose-500/20 text-rose-200 ring-rose-400/40",
    tendencies: {
      vpip: 0.62,
      openRaise: 0.75,
      callRaise: 0.45,
      threeBet: 0.12,
      foldToThreeBet: 0.3,
      cbet: 0.75,
      bluffFreq: 0.4,
      thinValue: 0.6,
      callAnyPair: 0.75,
      callDraw: 0.8,
      callOvercards: 0.5,
      foldTopPair: 0.15,
      raiseStrong: 0.6,
      donk: 0.35,
      blockBet: 0.1,
      sizingBias: 1.35,
    },
  },
  tight: {
    id: "tight",
    name: "Tight and solid",
    badge: "TAG",
    icon: "🛡️",
    blurb: "Plays few hands and mostly has it. Give this one credit.",
    badgeClass: "bg-amber-500/20 text-amber-200 ring-amber-400/40",
    tendencies: {
      vpip: 0.2,
      openRaise: 0.85,
      callRaise: 0.1,
      threeBet: 0.06,
      foldToThreeBet: 0.6,
      cbet: 0.65,
      bluffFreq: 0.18,
      thinValue: 0.45,
      callAnyPair: 0.45,
      callDraw: 0.5,
      callOvercards: 0.12,
      foldTopPair: 0.35,
      raiseStrong: 0.8,
      donk: 0.08,
      blockBet: 0.12,
      sizingBias: 1.0,
    },
  },
};

/**
 * How often each archetype shows up when a table is filled. Weighted for a
 * casual house game: mostly stations and limpers, one occasional maniac, and
 * the rare player who actually knows what he is doing.
 */
export const PROFILE_MIX: Array<{ id: Exclude<ProfileId, "hero">; weight: number }> = [
  { id: "station", weight: 0.4 },
  { id: "limper", weight: 0.32 },
  { id: "maniac", weight: 0.16 },
  { id: "tight", weight: 0.12 },
];

/** Names that look like the people you actually play with. */
export const OPPONENT_NAMES = [
  "Dave",
  "Marcus",
  "Tony",
  "Rich",
  "Sam",
  "Nikki",
  "Jordan",
  "Priya",
  "Chris",
  "Alex",
  "Megan",
  "Pete",
];
