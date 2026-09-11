# House Game Poker Trainer

Texas Hold'em practice for one specific game: a casual $0.25/$0.50 home game where
most players see too many flops, limp instead of raising, call far too often, chase
every draw, and never fold a pair. The trainer does not teach balanced or GTO poker.
It teaches the **exploitative** adjustments that win the most money against that table,
and grades your decisions on whether they were right — not on whether they worked.

Everything runs in the browser. No API keys, no environment variables, no server.

## Running it locally

```bash
npm install
npm run dev          # http://localhost:3000
```

Other commands:

```bash
npm test             # Vitest unit tests for the engine
npm run build        # production build, same as Vercel runs
npm run sim          # deal hands in the terminal against the opponent model
npm run sim -- --hands 5 --players 6 --seed 42
```

## Deploying

Import the repository on Vercel and accept the defaults. It is a standard Next.js
App Router project with no environment variables.

## How it is put together

The poker logic is pure TypeScript with no React anywhere in it, so it can be tested
directly and reused by the drills.

| Path | What lives there |
| --- | --- |
| `src/lib/cards.ts` | Card encoding, seeded RNG, shuffling, decks |
| `src/lib/evaluator.ts` | Seven-card hand evaluator, one integer score per hand |
| `src/lib/handRank.ts` | "Two pair, Kings and Sevens" style descriptions |
| `src/lib/table.ts` | Seats, positions and action order for 2–9 players |
| `src/lib/betting.ts` | Legal actions, minimum raises, all-ins, bet sizing |
| `src/lib/pot.ts` | Main pot, side pots, odd-chip rules, pot odds |
| `src/lib/handEngine.ts` | The hand state machine from blinds to showdown |
| `src/lib/handAnalysis.ts` | What a holding actually is: top pair, draws, tiers |
| `src/lib/equity.ts` | Monte Carlo equity against weighted opponent ranges |
| `src/lib/ranges.ts` | The 169-hand grid and the usual range shorthand |
| `src/lib/opponents/` | Opponent archetypes and the decision model that drives them |
| `src/lib/dealer.ts` | Starting hands, filling the table, playing opponents out |
| `src/data/` | **Tuning files** — ranges, tendencies and thresholds you can edit |
| `src/app/`, `src/components/` | The UI |

### Tuning the strategy

The numbers are deliberately kept out of the logic:

- `src/data/preflopRanges.ts` — the hero's opening, isolating, calling and 3-betting
  ranges by position, plus short-stack shoving ranges.
- `src/data/profileTendencies.ts` — how each opponent archetype behaves, and how often
  each archetype shows up at the table.
- `src/data/handRanking.ts` — the starting-hand strength order used to build
  "this player enters with 55% of hands" ranges.

Edit any of them and the engine, the opponents and the grading follow.

## Honesty about the strategy

The recommendations are strong exploitative heuristics for a loose, passive game.
They are not solver output. Where a spot is genuinely close the trainer says so and
grades more than one action as acceptable, and where a play is specifically a
house-game adjustment that would be a mistake against good players, it says that too.

## Status

- **Phase 1 — game engine and tests: done.** Deck, evaluator, betting rules, side
  pots, the hand state machine, opponent model and Monte Carlo equity, all under test.
- Phase 2 — table UI and full hand playthrough.
- Phase 3 — strategy engine and feedback.
- Phase 4 — practice modes and stats.
- Phase 5 — polish.
