/**
 * Headless engine check: deal hands, let the simulated home-game opponents play
 * them out, and print what happened. Run with `npm run sim -- --hands 5`.
 */
import { cardsToString, makeRng } from "../src/lib/cards";
import { DEFAULT_SETTINGS, startHand } from "../src/lib/dealer";
import { applyAction, isHandOver, potNow } from "../src/lib/handEngine";
import { chooseOpponentAction, pickProfile } from "../src/lib/opponents/opponentAI";
import { PROFILE_MIX, PROFILES } from "../src/data/profileTendencies";
import type { ProfileId } from "../src/lib/opponents/profiles";
import { formatMoney } from "../src/lib/money";
import type { ActionRecord, HandState } from "../src/lib/types";

function arg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

const hands = arg("hands", 3);
const tableSize = arg("players", 6);
const seed = arg("seed", Date.now() % 100000);
const verbose = !process.argv.includes("--quiet");

const rng = makeRng(seed);

function describeAction(state: HandState, action: ActionRecord): string {
  const player = state.players[action.seat];
  const label = `${player.name} (${state.positions[action.seat]})`;
  switch (action.type) {
    case "post":
      return `${label} posts ${formatMoney(action.amount)}`;
    case "fold":
      return `${label} folds`;
    case "check":
      return `${label} checks`;
    case "call":
      return `${label} calls ${formatMoney(action.amount)}${action.allIn ? " and is all in" : ""}`;
    default:
      return `${label} ${action.type}s to ${formatMoney(action.to)}${action.allIn ? " and is all in" : ""}`;
  }
}

let showdowns = 0;
let totalPot = 0;

for (let i = 0; i < hands; i++) {
  // Every seat is played by the opponent model, so the whole table gets a profile.
  const profiles = Array.from(
    { length: tableSize },
    () => pickProfile(rng, PROFILE_MIX) as ProfileId,
  );
  let state = startHand({ rng, settings: { ...DEFAULT_SETTINGS, tableSize }, profiles });

  if (verbose) {
    console.log(`\n=== Hand ${i + 1} (seed ${seed}) ===`);
    for (const player of state.players) {
      const profile = PROFILES[player.profile as "station"].name;
      console.log(
        `  seat ${player.seat} ${state.positions[player.seat].padEnd(4)} ${player.name.padEnd(8)} ` +
          `${formatMoney(player.stack).padStart(7)}  ${cardsToString(player.hole)}  ${profile}`,
      );
    }
  }

  let street = state.street;
  let steps = 0;
  while (!isHandOver(state) && state.actingSeat !== null && steps < 200) {
    if (verbose && state.street !== street) {
      street = state.street;
      console.log(`  -- ${street} -- ${cardsToString(state.board)} (pot ${formatMoney(potNow(state))})`);
    }
    const before = state.history.length;
    state = applyAction(state, chooseOpponentAction(state, rng));
    if (verbose) {
      for (const action of state.history.slice(before)) console.log(`  ${describeAction(state, action)}`);
    }
    steps += 1;
  }

  if (verbose && state.board.length > 0) {
    console.log(`  board: ${cardsToString(state.board)}`);
  }
  if (state.result) {
    totalPot += state.result.finalPot;
    if (state.result.wentToShowdown) showdowns += 1;
    if (verbose) console.log(`  ${state.result.summary} (pot ${formatMoney(state.result.finalPot)})`);
  }
}

console.log(
  `\n${hands} hands, ${showdowns} showdowns, average pot ${formatMoney(Math.round(totalPot / hands))}.`,
);
