import { STREET_LABELS } from "@/lib/handLog";
import { formatMoney } from "@/lib/money";
import { countGood, type DecisionRecord } from "@/lib/strategy/decision";
import { resultHonestyNote } from "@/lib/strategy/explain";
import { conceptName } from "@/lib/strategy/concepts";
import type { HandState } from "@/lib/types";
import { GradeBadge } from "./FeedbackPanel";

export interface HandSummaryProps {
  state: HandState;
  decisions: DecisionRecord[];
  onNextHand: () => void;
}

export function HandSummary({ state, decisions, onNextHand }: HandSummaryProps) {
  const net = state.result?.net[state.config.heroSeat] ?? 0;
  const good = countGood(decisions);
  const honesty = resultHonestyNote(good, decisions.length, net);

  return (
    <section className="flex w-full flex-col gap-3">
      <div className="text-center text-sm text-white/75">
        {state.result ? (
          state.result.summary
        ) : (
          <span className="text-white/50">Drill spot graded — the hand stops here.</span>
        )}
        {net !== 0 ? (
          <span className={`ml-1 font-semibold ${net > 0 ? "text-emerald-300" : "text-rose-300"}`}>
            ({net > 0 ? "+" : ""}
            {formatMoney(net)})
          </span>
        ) : null}
      </div>

      {decisions.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {decisions.map((decision, index) => (
            <li
              key={index}
              className="flex items-center justify-between gap-2 rounded-lg bg-black/30 px-2.5 py-1.5 text-xs ring-1 ring-white/10"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-14 shrink-0 text-[0.65rem] uppercase tracking-wide text-white/40">
                  {STREET_LABELS[decision.street]}
                </span>
                <span className="truncate font-medium text-white/85">{decision.chosenLabel}</span>
                <span className="hidden truncate text-white/40 sm:inline">
                  {conceptName(decision.concept)}
                </span>
              </span>
              <GradeBadge grade={decision.grade} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-center text-xs text-white/40">No decisions to grade this hand.</p>
      )}

      {decisions.length > 0 ? (
        <p className="text-center text-xs text-white/55">
          {good} of {decisions.length} decisions graded good or better.
        </p>
      ) : null}

      {honesty ? (
        <p className="rounded-lg bg-sky-500/10 px-3 py-2 text-xs leading-relaxed text-sky-100/90 ring-1 ring-sky-400/25">
          {honesty}
        </p>
      ) : null}

      <button
        type="button"
        onClick={onNextHand}
        className="self-center rounded-lg bg-emerald-600 px-6 py-2 text-sm font-semibold text-white ring-1 ring-emerald-300/40 transition hover:bg-emerald-500 active:scale-[0.98]"
      >
        Next hand
      </button>
    </section>
  );
}
