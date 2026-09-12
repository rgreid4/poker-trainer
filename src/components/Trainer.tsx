"use client";

import { useTrainer } from "@/hooks/useTrainer";
import { evaluateHand } from "@/lib/evaluator";
import { describeScore } from "@/lib/handRank";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/lib/table";
import { formatMoney, formatMoneyWithBB } from "@/lib/money";
import { potNow } from "@/lib/handEngine";
import { ActionBar } from "./ActionBar";
import { ActionLog } from "./ActionLog";
import { FeedbackPanel } from "./FeedbackPanel";
import { HandSummary } from "./HandSummary";
import { PokerTable } from "./PokerTable";

const TABLE_SIZES = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS);

export function Trainer() {
  const trainer = useTrainer();
  const { state, settings, setSettings, isHeroTurn, handOver, handNumber } = trainer;

  if (!state) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-sm text-white/50">
        Shuffling up…
      </div>
    );
  }

  const hero = state.players[state.config.heroSeat];
  const heroHand =
    state.board.length >= 3 ? describeScore(evaluateHand(hero.hole, state.board)) : null;
  const playersInPot = state.players.filter((p) => p.status !== "folded").length;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-4 px-3 py-4 sm:px-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">House Game Poker Trainer</h1>
          <p className="text-xs text-white/50">
            Hand {handNumber} · {formatMoney(state.config.smallBlind)}/
            {formatMoney(state.config.bigBlind)} · you are{" "}
            <span className="text-white/80">{state.positions[state.config.heroSeat]}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 rounded-lg bg-black/30 px-2 py-1.5 ring-1 ring-white/10">
            <span className="text-white/50">Players</span>
            <select
              value={settings.tableSize}
              onChange={(event) => setSettings({ tableSize: Number(event.target.value) })}
              className="bg-transparent font-semibold text-white outline-none"
            >
              {TABLE_SIZES.map((size) => (
                <option key={size} value={size} className="bg-neutral-900">
                  {size}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => setSettings({ showProfiles: !settings.showProfiles })}
            className={`rounded-lg px-2.5 py-1.5 font-medium ring-1 transition ${
              settings.showProfiles
                ? "bg-emerald-600/30 text-emerald-100 ring-emerald-400/40"
                : "bg-black/30 text-white/60 ring-white/10"
            }`}
            title="Hide the profile badges for a harder read"
          >
            {settings.showProfiles ? "Profiles shown" : "Profiles hidden"}
          </button>

          <button
            type="button"
            onClick={() => setSettings({ speedMs: settings.speedMs === 550 ? 180 : 550 })}
            className="rounded-lg bg-black/30 px-2.5 py-1.5 font-medium text-white/60 ring-1 ring-white/10 transition hover:text-white"
          >
            {settings.speedMs === 550 ? "Normal speed" : "Fast"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3">
          <PokerTable state={state} showProfiles={settings.showProfiles} />

          <div className="flex min-h-24 flex-col items-center gap-2 rounded-xl bg-black/30 p-3 ring-1 ring-white/10">
            {isHeroTurn ? (
              <>
                <div className="text-xs text-white/55">
                  {playersInPot} players in the pot · pot{" "}
                  {formatMoneyWithBB(potNow(state), state.config.bigBlind)}
                  {heroHand ? (
                    <>
                      {" "}
                      · you have <span className="text-white/80">{heroHand}</span>
                    </>
                  ) : null}
                </div>
                <ActionBar state={state} onAction={trainer.act} />
              </>
            ) : handOver ? (
              <HandSummary
                state={state}
                decisions={trainer.decisions}
                onNextHand={trainer.deal}
              />
            ) : (
              <div className="flex items-center gap-2 py-4 text-sm text-white/45">
                <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                {state.actingSeat !== null
                  ? `${state.players[state.actingSeat].name} is thinking…`
                  : "Dealing…"}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-3 lg:w-80 lg:shrink-0">
          {trainer.feedback ? <FeedbackPanel decision={trainer.feedback} /> : null}
          <div className="min-h-40 flex-1">
            <ActionLog state={state} />
          </div>
        </aside>
      </div>
    </main>
  );
}
