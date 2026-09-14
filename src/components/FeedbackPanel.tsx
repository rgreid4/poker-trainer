import { STREET_LABELS } from "@/lib/handLog";
import type { DecisionRecord } from "@/lib/strategy/decision";
import type { EquityWorking } from "@/lib/strategy/explain";
import { GRADE_LABELS, GRADE_STYLES } from "@/lib/strategy/grade";

export function GradeBadge({
  grade,
  className = "",
}: {
  grade: DecisionRecord["grade"];
  className?: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide ring-1 ${GRADE_STYLES[grade]} ${className}`}
    >
      {GRADE_LABELS[grade]}
    </span>
  );
}

export interface FeedbackPanelProps {
  decision: DecisionRecord;
  /** Show the full reasoning instead of the one-line version. */
  detailed: boolean;
  onToggleDetail: () => void;
}

/**
 * Feedback after a decision. It leads with one line — what to do and why — and
 * keeps the full reasoning, all the numbers and the concept behind a toggle,
 * so reading it between hands takes a couple of seconds.
 */
export function FeedbackPanel({ decision, detailed, onToggleDetail }: FeedbackPanelProps) {
  const { explanation } = decision;
  const wasBest = decision.grade === "best";

  return (
    <section className="flex flex-col gap-2.5 rounded-xl bg-black/40 p-3 ring-1 ring-white/10">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/40">
            {STREET_LABELS[decision.street]}
          </div>
          <div className="truncate text-sm font-semibold text-white/90">
            {decision.chosenLabel}
            {wasBest ? null : (
              <>
                <span className="mx-1 text-white/30">→</span>
                <span className="text-emerald-200">{decision.recommendedLabel}</span>
              </>
            )}
          </div>
        </div>
        <GradeBadge grade={decision.grade} />
      </header>

      <p className="text-sm leading-snug text-white/85">{explanation.oneLiner}</p>

      <div className="flex flex-wrap gap-1.5">
        {explanation.keyNumbers.map((entry) => (
          <span
            key={entry.label}
            title={entry.hint}
            className="rounded-lg bg-white/5 px-2 py-1 text-[0.7rem] text-white/60"
          >
            {entry.label}{" "}
            <span className="font-semibold tabular-nums text-white/90">{entry.value}</span>
          </span>
        ))}
        {decision.close ? (
          <span
            className="rounded-lg bg-amber-500/15 px-2 py-1 text-[0.7rem] text-amber-100/90"
            title={explanation.closeNote ?? undefined}
          >
            Close spot
          </span>
        ) : null}
        {explanation.houseGameNote ? (
          <span
            className="rounded-lg bg-white/5 px-2 py-1 text-[0.7rem] text-white/50"
            title={explanation.houseGameNote}
          >
            🏠 house-game play
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.7rem] font-medium text-sky-200/80">
          🎯 {explanation.conceptName}
        </span>
        <button
          type="button"
          onClick={onToggleDetail}
          aria-expanded={detailed}
          className="shrink-0 rounded-lg px-2 py-1 text-[0.7rem] text-white/45 ring-1 ring-white/10 transition hover:text-white"
        >
          {detailed ? "Less" : "Why?"}
        </button>
      </div>

      {detailed ? (
        <div className="flex flex-col gap-3 border-t border-white/10 pt-3">
          <div className="space-y-1.5 text-xs leading-relaxed text-white/75">
            {explanation.sentences.map((sentence, i) => (
              <p key={i}>{sentence}</p>
            ))}
          </div>

          <dl className="grid grid-cols-2 gap-1.5 text-[0.7rem] sm:grid-cols-3">
            {explanation.numbers.map((entry) => (
              <div key={entry.label} className="rounded-lg bg-white/5 px-2 py-1.5">
                <dt className="text-[0.6rem] uppercase tracking-wide text-white/40">
                  {entry.label}
                </dt>
                <dd className="font-semibold tabular-nums text-white/90">{entry.value}</dd>
                {entry.hint ? <dd className="text-[0.6rem] text-white/45">{entry.hint}</dd> : null}
              </div>
            ))}
          </dl>

          <EquityWorkingBlock working={explanation.equityWorking} />

          <p className="text-[0.7rem] leading-relaxed text-white/50">
            <span className="font-semibold text-sky-200/80">{explanation.conceptName}:</span>{" "}
            {explanation.conceptBlurb}
          </p>

          {explanation.closeNote ? (
            <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[0.7rem] text-amber-100/90 ring-1 ring-amber-400/25">
              {explanation.closeNote}
            </p>
          ) : null}

          {explanation.houseGameNote ? (
            <p className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[0.7rem] text-white/55">
              🏠 {explanation.houseGameNote}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Shows where the equity number came from: how many runouts were simulated,
 * how they finished, and what range each opponent was dealt from. The estimate
 * is only as good as those ranges, so they are worth seeing.
 */
function EquityWorkingBlock({ working }: { working: EquityWorking }) {
  // Round so the three shares always add up to a hundred on screen.
  const wonPct = Math.round(working.win * 100);
  const tiedPct = Math.round(working.tie * 100);
  const lostPct = 100 - wonPct - tiedPct;

  const street =
    working.boardCards === 0
      ? "all five board cards"
      : working.boardCards === 5
        ? "no more cards"
        : `the remaining ${5 - working.boardCards} board card${5 - working.boardCards === 1 ? "" : "s"}`;

  return (
    <div className="rounded-lg bg-white/5 p-2.5">
      <h4 className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.15em] text-white/40">
        How the equity was worked out
      </h4>

      <p className="text-[0.7rem] leading-relaxed text-white/60">
        {working.runouts.toLocaleString()} runouts: each one deals every opponent a hand from the
        range below, deals {street}, and scores every hand. You won{" "}
        <span className="font-semibold text-white/85">{percent(working.win)}</span>, tied{" "}
        <span className="font-semibold text-white/85">{percent(working.tie)}</span> and lost{" "}
        <span className="font-semibold text-white/85">{percent(working.lose)}</span> of them.
      </p>

      {working.opponents.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-1.5">
          {working.opponents.map((opponent) => (
            <li key={opponent.seat} className="text-[0.7rem] leading-snug">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-white/80">
                  <span className="font-semibold">{opponent.name}</span>
                  <span className="text-white/45">
                    {" "}
                    · {opponent.profileName.toLowerCase()} · {opponent.readLabel}
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-white/60">
                  you {percent(opponent.equityVs)}
                </span>
              </div>
              <div className="text-white/45">
                {opponent.combos} hands in their range ({percent(opponent.widthPercent)} of all
                starting hands)
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-2 text-[0.65rem] leading-relaxed text-white/35">
        Those ranges come from each player&apos;s profile and what they have actually done this
        hand, so the equity is an estimate against a modelled range — not a solved number.
      </p>
    </div>
  );
}
