"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/money";
import {
  type StatsSnapshot,
  accuracy,
  formatAccuracy,
  overallAccuracy,
  weakestConcepts,
} from "@/lib/stats";
import { CONCEPTS } from "@/lib/strategy/concepts";
import { STREET_LABELS } from "@/lib/handLog";
import { STREETS } from "@/lib/types";
import { GradeBadge } from "./FeedbackPanel";

function Bar({ value }: { value: number | null }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className={`h-full rounded-full transition-all ${
          value === null
            ? "bg-white/20"
            : value >= 0.7
              ? "bg-emerald-400"
              : value >= 0.5
                ? "bg-amber-400"
                : "bg-rose-400"
        }`}
        style={{ width: `${Math.round((value ?? 0) * 100)}%` }}
      />
    </div>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-black/30 px-3 py-2 ring-1 ring-white/10">
      <div className="text-[0.6rem] uppercase tracking-wide text-white/40">{label}</div>
      <div className="text-lg font-bold tabular-nums text-white/95">{value}</div>
      {hint ? <div className="text-[0.65rem] text-white/45">{hint}</div> : null}
    </div>
  );
}

export interface StatsPanelProps {
  stats: StatsSnapshot;
  onReset: () => void;
  onClose: () => void;
}

export function StatsPanel({ stats, onReset, onClose }: StatsPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const concepts = weakestConcepts(stats, 1);

  return (
    <section className="flex flex-col gap-4 rounded-xl bg-black/35 p-4 ring-1 ring-white/10">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight">Your progress</h2>
        <div className="flex items-center gap-2 text-xs">
          {confirming ? (
            <>
              <span className="text-white/60">Erase all progress?</span>
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setConfirming(false);
                }}
                className="rounded-lg bg-rose-700/80 px-2.5 py-1.5 font-semibold text-rose-50 ring-1 ring-rose-400/40 hover:bg-rose-600"
              >
                Yes, reset
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-lg bg-black/30 px-2.5 py-1.5 text-white/70 ring-1 ring-white/10 hover:text-white"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="rounded-lg bg-black/30 px-2.5 py-1.5 text-white/60 ring-1 ring-white/10 transition hover:text-white"
            >
              Reset stats
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-600/80 px-3 py-1.5 font-semibold text-white ring-1 ring-emerald-300/40 hover:bg-emerald-500"
          >
            Back to the table
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Hands played" value={String(stats.handsPlayed)} />
        <Stat
          label="Good or better"
          value={formatAccuracy(overallAccuracy(stats))}
          hint={`${stats.goodOrBetter} of ${plural(stats.decisions, "decision")}`}
        />
        <Stat
          label="Best plays"
          value={String(stats.byGrade.best ?? 0)}
          hint={`${plural(stats.byGrade.mistake ?? 0, "mistake")}, ${plural(
            stats.byGrade.blunder ?? 0,
            "blunder",
          )}`}
        />
        <Stat
          label="Net at the table"
          value={formatMoney(stats.netCents)}
          hint="full hands only, not drills"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            By street
          </h3>
          <ul className="flex flex-col gap-2">
            {STREETS.map((street) => {
              const tally = stats.byStreet[street];
              const value = accuracy(tally);
              return (
                <li key={street} className="text-xs">
                  <div className="mb-1 flex items-baseline justify-between">
                    <span className="text-white/70">{STREET_LABELS[street]}</span>
                    <span className="tabular-nums text-white/50">
                      {formatAccuracy(value)}{" "}
                      <span className="text-white/30">({tally.decisions})</span>
                    </span>
                  </div>
                  <Bar value={value} />
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            By concept — weakest first
          </h3>
          {concepts.length === 0 ? (
            <p className="text-xs text-white/40">Play some hands and this fills in.</p>
          ) : (
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
              {concepts.map(({ concept, tally, accuracy: value }) => (
                <li key={concept} className="text-xs">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-white/70" title={CONCEPTS[concept].blurb}>
                      {CONCEPTS[concept].name}
                    </span>
                    <span className="shrink-0 tabular-nums text-white/50">
                      {formatAccuracy(value)}{" "}
                      <span className="text-white/30">({tally.decisions})</span>
                    </span>
                  </div>
                  <Bar value={value} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          Recent mistakes to review
        </h3>
        {stats.mistakes.length === 0 ? (
          <p className="text-xs text-white/40">
            Nothing here yet. Mistakes and blunders land in this list so you can look back at them.
          </p>
        ) : (
          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
            {stats.mistakes.map((mistake, index) => (
              <li
                key={`${mistake.at}-${index}`}
                className="rounded-lg bg-black/30 p-2.5 text-xs ring-1 ring-white/10"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <GradeBadge grade={mistake.grade} />
                  <span className="text-[0.65rem] uppercase tracking-wide text-white/40">
                    {STREET_LABELS[mistake.street]}
                  </span>
                  <span className="text-white/50">{CONCEPTS[mistake.concept].name}</span>
                </div>
                <div className="text-white/80">
                  You played <span className="font-semibold">{mistake.chosenLabel}</span> with{" "}
                  {mistake.handLabel}; better was{" "}
                  <span className="font-semibold text-emerald-200">
                    {mistake.recommendedLabel}
                  </span>
                  .
                </div>
                {mistake.lesson ? (
                  <p className="mt-1 text-[0.7rem] leading-relaxed text-white/55">
                    {mistake.lesson}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
