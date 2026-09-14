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
| `src/lib/opponents/` | Opponent archetypes, their decision model, and the range reads |
| `src/lib/strategy/` | Recommending a play, grading the choice, and explaining why |
| `src/lib/practice/` | Practice modes and the spot-drill generators |
| `src/lib/stats.ts` | Progress tracking, persisted to localStorage |
| `src/lib/settings.ts` | Table and practice settings, persisted and validated on load |
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
- `src/data/thresholds.ts` — the equity, pot-odds, bet-sizing and grading cutoffs the
  strategy engine compares against.
- `src/data/rangeWeights.ts` — how to read an opponent: how much each hand tier is
  discounted when a passive player checks, calls, bets small, bets big, or raises.

Edit any of them and the engine, the opponents and the grading follow.

## Honesty about the strategy

The recommendations are strong exploitative heuristics for a loose, passive game.
They are not solver output. Where a spot is genuinely close the trainer says so and
grades more than one action as acceptable, and where a play is specifically a
house-game adjustment that would be a mistake against good players, it says that too.

## Status

- **Phase 1 — game engine and tests: done.** Deck, evaluator, betting rules, side
  pots, the hand state machine, opponent model and Monte Carlo equity, all under test.
- **Phase 2 — table UI and full hand playthrough: done.** Felt table, position labels,
  profile badges, action buttons in dollars and big blinds, showdown and hand history.
- **Phase 3 — strategy engine and feedback: done.** Every decision is graded Best
  through Blunder, with the recommended play, the reasoning in terms of these
  opponents, the numbers behind it, and one key concept.
- **Phase 4 — practice modes and stats: done.** Full hands, a preflop drill, six
  house-game spot drills, and progress tracking in localStorage.
- **Phase 5 — polish: done.** Help panel, remembered settings, animation and mobile
  passes, and a guard that fails the tests on any React warning.

## Feedback

After every decision the panel shows one line: what you did, what was better, and
why in a single sentence, plus the two numbers that drove it and the concept being
taught. "Why?" expands the full reasoning — the spot-specific paragraphs, every
number with its context, the concept in full, and the close-spot and house-game
notes. The choice is remembered, so if you prefer the long version it stays open.

## Where the equity number comes from

Expanding "Why?" shows the working behind the equity: how many runouts were
simulated, how they finished (won, tied, lost), and for each opponent their
archetype, what they did this hand, how many two-card combinations their range
still contains, and your equity against them alone. The estimate is only as good
as those ranges, so the panel shows them rather than asking you to trust a number.

## How a decision gets graded

1. **Read the opponents.** Each live opponent starts from the preflop range their
   archetype plays for the line they took — a calling station who limped is on a
   very wide range, one who raised is on roughly the top 7% — then every combo is
   weighted by how consistent it is with what they have done on each street since.
   A passive player who check-raises keeps almost nothing but two pair or better.
2. **Measure.** Monte Carlo equity (a few thousand runouts) against those weighted
   ranges, plus exact pot odds, SPR and effective stacks.
3. **Score every legal option.** Fold, check, call and each offered bet size get a
   score from the thresholds in `src/data/thresholds.ts`, including how well the
   size matches the plan — so betting the right amount is graded too.
4. **Grade by the gap, never by the result.** The top action is Best; the bands for
   Good, Acceptable, Mistake and Blunder come from how far short the chosen action
   fell. When two plays are within a hair of each other the trainer says the spot is
   close and marks both as fine.
5. **Explain it.** Two to four sentences naming the tendency being exploited, the
   numbers, one key concept, and a flag when the recommendation is a house-game
   adjustment that would be a leak against strong players.

## Practice modes

- **Full hands** — every street from the deal to showdown.
- **Preflop drill** — one preflop decision per hand, graded immediately, then the
  next hand. Fast reps.
- **Spot drills** — isolating limpers, multiway pots, thin value against calling
  stations, folding to passive aggression, draws with several callers, and
  short-stack all-ins.

The spot drills do not build positions by hand. They deal real hands and play the
ones that miss, so the stacks, ranges and action history all belong to a game that
actually happened. If a drill cannot produce its situation within a hundred or so
deals it says so and gives you an ordinary hand rather than faking one.

## Progress tracking

Stats live in `localStorage` under `poker-trainer/stats/v1`:

- hands played, decisions, and the share graded Good or better
- accuracy by street and by concept, with the weakest concepts listed first
- your last twenty mistakes and blunders, each with the hand, what you did, what was
  better, and the one sentence that explains why
- net at the table across full hands (drills are excluded, since they are not real
  money)

There is a reset button behind a confirmation in the stats panel. Nothing leaves the
browser.

## Help and settings

The **?** button opens a panel covering the grading scale, the four opponent
archetypes and their tells, position by position play, pot odds and equity with a
worked example, the nine rules for beating a loose home game, and every key concept
the grader uses. Concepts that only apply to this kind of game are marked 🏠.

Table size, practice mode, opponent-badge visibility and opponent speed are remembered
in `localStorage` and validated on the way back in, so a hand-edited or stale value
falls back to the default instead of breaking the table.

## Testing notes

`npm test` runs two projects: the engine suite in Node and the UI suite in jsdom. The
UI setup clears `localStorage` before each test and **fails any test where React logs
a warning** — duplicate keys, invalid props, or updates outside `act`. That guard
exists because a mangled `key` slipped through a green suite once; the browser console
caught it, so now the tests do.
