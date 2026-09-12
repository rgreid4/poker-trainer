import { STREET_LABELS } from "@/lib/handLog";
import type { DecisionRecord } from "@/lib/strategy/decision";
import { GRADE_LABELS, GRADE_STYLES } from "@/lib/strategy/grade";

export function GradeBadge({ grade, className = "" }: { grade: DecisionRecord["grade"]; className?: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide ring-1 ${GRADE_STYLES[grade]} ${className}`}
    >
      {GRADE_LABELS[grade]}
    </span>
  );
}

export function FeedbackPanel({ decision }: { decision: DecisionRecord }) {
  const { explanation } = decision;

  return (
    <section className="flex flex-col gap-3 rounded-xl bg-black/40 p-3 ring-1 ring-white/10">
      <header className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.65rem] uppercase tracking-[0.2em] text-white/40">
            {STREET_LABELS[decision.street]} decision
          </div>
          <div className="truncate text-sm font-semibold text-white/90">{decision.chosenLabel}</div>
        </div>
        <GradeBadge grade={decision.grade} />
      </header>

      {decision.grade !== "best" ? (
        <div className="rounded-lg bg-emerald-500/10 px-2.5 py-1.5 text-xs ring-1 ring-emerald-400/25">
          <span className="text-white/50">Recommended: </span>
          <span className="font-semibold text-emerald-100">{decision.recommendedLabel}</span>
        </div>
      ) : null}

      <div className="space-y-1.5 text-xs leading-relaxed text-white/80">
        {explanation.sentences.map((sentence, i) => (
          <p key={i}>{sentence}</p>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-1.5 text-[0.7rem] sm:grid-cols-3">
        {explanation.numbers.map((entry) => (
          <div key={entry.label} className="rounded-lg bg-white/5 px-2 py-1.5">
            <dt className="text-[0.6rem] uppercase tracking-wide text-white/40">{entry.label}</dt>
            <dd className="font-semibold tabular-nums text-white/90">{entry.value}</dd>
            {entry.hint ? <dd className="text-[0.6rem] text-white/45">{entry.hint}</dd> : null}
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-1.5">
        <div
          className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-1 text-[0.7rem] font-semibold text-sky-100 ring-1 ring-sky-400/30"
          title={explanation.conceptBlurb}
        >
          <span aria-hidden>🎯</span>
          {explanation.conceptName}
        </div>
        <p className="text-[0.7rem] leading-relaxed text-white/50">{explanation.conceptBlurb}</p>
      </div>

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
    </section>
  );
}
