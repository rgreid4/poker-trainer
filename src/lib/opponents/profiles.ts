/**
 * Opponent archetypes for a loose home game. The behavioural numbers live in
 * `src/data/profileTendencies.ts` so they can be tuned without touching logic.
 */
export type ProfileId = "hero" | "station" | "limper" | "maniac" | "tight";

export const OPPONENT_PROFILE_IDS: ProfileId[] = ["station", "limper", "maniac", "tight"];

export interface ProfileTendencies {
  /** Share of hands this player enters the pot with. */
  vpip: number;
  /** Of the hands played when first in, the share raised rather than limped. */
  openRaise: number;
  /** Share of all hands used to call a preflop raise. */
  callRaise: number;
  /** Share of all hands used to 3-bet. */
  threeBet: number;
  /** Chance of folding to a 3-bet with a hand that entered the pot. */
  foldToThreeBet: number;

  /** Chance of betting when checked to with a decent made hand. */
  cbet: number;
  /** Chance of firing with no pair and no draw. */
  bluffFreq: number;
  /** Chance of betting a marginal made hand for thin value. */
  thinValue: number;
  /** Chance of calling a bet holding any pair, largely ignoring price. */
  callAnyPair: number;
  /** Chance of calling a bet holding a draw, largely ignoring price. */
  callDraw: number;
  /** Chance of calling a bet with nothing but overcards or backdoors. */
  callOvercards: number;
  /** Chance of folding top pair to heavy aggression. Low here by design. */
  foldTopPair: number;
  /** Chance of raising with a strong hand instead of just calling. */
  raiseStrong: number;
  /** Chance of leading into the preflop aggressor with something decent. */
  donk: number;
  /** Chance of making a small blocking bet with a medium hand. */
  blockBet: number;
  /** Multiplier applied to bet sizes; maniacs bet big, limpers bet small. */
  sizingBias: number;
}

export interface OpponentProfile {
  id: ProfileId;
  /** Full name for the help panel. */
  name: string;
  /** Two or three letters shown on the seat badge. */
  badge: string;
  /** Emoji shown next to the badge. */
  icon: string;
  /** One line the trainer can quote in feedback. */
  blurb: string;
  /** Tailwind classes for the seat badge. */
  badgeClass: string;
  tendencies: ProfileTendencies;
}

/** How much a raise from this player should scare you, 0..1. */
export function aggressionMeansStrength(profile: OpponentProfile): number {
  return profile.tendencies.raiseStrong * (1 - profile.tendencies.bluffFreq * 2.5);
}

/** True for opponents who call far too much and bluff-catch with anything. */
export function isCallingStation(id: ProfileId): boolean {
  return id === "station" || id === "limper";
}
