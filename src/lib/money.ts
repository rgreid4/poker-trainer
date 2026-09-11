/**
 * All money in the engine is an integer number of cents. Poker math is full of
 * halves and thirds of pots; keeping it in cents means pot/side-pot arithmetic
 * is exact and tests can compare numbers directly.
 */
export type Cents = number;

export function dollars(amount: number): Cents {
  return Math.round(amount * 100);
}

export function formatMoney(cents: Cents): string {
  const value = cents / 100;
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function toBigBlinds(cents: Cents, bigBlind: Cents): number {
  return cents / bigBlind;
}

export function formatBigBlinds(cents: Cents, bigBlind: Cents): string {
  const bb = toBigBlinds(cents, bigBlind);
  const rounded = Math.round(bb * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}bb`;
}

/** "$3.50 (7bb)" — every amount the trainer shows the user carries both units. */
export function formatMoneyWithBB(cents: Cents, bigBlind: Cents): string {
  return `${formatMoney(cents)} (${formatBigBlinds(cents, bigBlind)})`;
}

/** Round a computed bet to a whole number of cents, clamped into a legal range. */
export function clampBet(amount: Cents, min: Cents, max: Cents): Cents {
  return Math.max(min, Math.min(max, Math.round(amount)));
}
