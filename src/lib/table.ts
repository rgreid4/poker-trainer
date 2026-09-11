/** Position labels, earliest to latest in postflop action order. */
export type Position =
  | "UTG"
  | "UTG+1"
  | "UTG+2"
  | "MP"
  | "HJ"
  | "CO"
  | "BTN"
  | "SB"
  | "BB";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 9;

/**
 * Position names in preflop action order (first to act first), for each table
 * size. Heads-up is the special case: the button posts the small blind and acts
 * first preflop, last postflop.
 */
const PREFLOP_ORDER: Record<number, Position[]> = {
  2: ["BTN", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["UTG", "BTN", "SB", "BB"],
  5: ["UTG", "CO", "BTN", "SB", "BB"],
  6: ["UTG", "MP", "CO", "BTN", "SB", "BB"],
  7: ["UTG", "MP", "HJ", "CO", "BTN", "SB", "BB"],
  8: ["UTG", "UTG+1", "MP", "HJ", "CO", "BTN", "SB", "BB"],
  9: ["UTG", "UTG+1", "UTG+2", "MP", "HJ", "CO", "BTN", "SB", "BB"],
};

export function positionsForTableSize(size: number): Position[] {
  const order = PREFLOP_ORDER[size];
  if (!order) throw new Error(`Unsupported table size: ${size}`);
  return order;
}

/**
 * Map every seat index to its position for this hand.
 * Seats are fixed and the button moves; seat `buttonSeat` is always "BTN"
 * (or the heads-up button, which is also the small blind).
 */
export function assignPositions(tableSize: number, buttonSeat: number): Position[] {
  const order = positionsForTableSize(tableSize);
  const buttonIndexInOrder = order.indexOf("BTN");
  const positions: Position[] = new Array(tableSize);
  for (let i = 0; i < tableSize; i++) {
    // Seats run clockwise; the order array runs in preflop action order, which
    // is the same rotation offset from the button.
    const seat = (buttonSeat + i - buttonIndexInOrder + tableSize * 2) % tableSize;
    positions[seat] = order[i];
  }
  return positions;
}

export function seatOfPosition(positions: readonly Position[], position: Position): number {
  const seat = positions.indexOf(position);
  if (seat < 0) throw new Error(`No seat has position ${position}`);
  return seat;
}

/** Small blind seat. Heads-up the button posts it. */
export function smallBlindSeat(positions: readonly Position[]): number {
  return positions.length === 2
    ? seatOfPosition(positions, "BTN")
    : seatOfPosition(positions, "SB");
}

export function bigBlindSeat(positions: readonly Position[]): number {
  return seatOfPosition(positions, "BB");
}

/** Seats in preflop action order, starting left of the big blind. */
export function preflopOrder(tableSize: number, buttonSeat: number): number[] {
  const positions = assignPositions(tableSize, buttonSeat);
  const bb = bigBlindSeat(positions);
  const seats: number[] = [];
  for (let i = 1; i <= tableSize; i++) seats.push((bb + i) % tableSize);
  return seats;
}

/** Seats in postflop action order, starting left of the button. */
export function postflopOrder(tableSize: number, buttonSeat: number): number[] {
  const seats: number[] = [];
  for (let i = 1; i <= tableSize; i++) seats.push((buttonSeat + i) % tableSize);
  return seats;
}

/**
 * 0 = earliest position, 1 = button. Used by the strategy engine to widen or
 * tighten ranges without hard-coding every label.
 */
export function positionalRank(positions: readonly Position[], seat: number): number {
  const order = positionsForTableSize(positions.length);
  const idx = order.indexOf(positions[seat]);
  const btn = order.indexOf("BTN");
  if (idx <= btn) return btn === 0 ? 1 : idx / btn;
  return 0; // blinds act first on every street after the flop
}

export const LATE_POSITIONS: Position[] = ["CO", "BTN"];

export function isLatePosition(position: Position): boolean {
  return LATE_POSITIONS.includes(position);
}

export function isBlind(position: Position): boolean {
  return position === "SB" || position === "BB";
}
