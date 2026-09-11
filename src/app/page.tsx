const PHASES = [
  { name: "Phase 1", title: "Game engine and tests", status: "done" },
  { name: "Phase 2", title: "Table UI and full hand playthrough", status: "next" },
  { name: "Phase 3", title: "Strategy engine and feedback", status: "todo" },
  { name: "Phase 4", title: "Practice modes and stats", status: "todo" },
  { name: "Phase 5", title: "Polish", status: "todo" },
];

const STATUS_STYLES: Record<string, string> = {
  done: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
  next: "bg-amber-500/20 text-amber-200 ring-amber-400/40",
  todo: "bg-white/10 text-white/60 ring-white/20",
};

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-300/80">
          $0.25 / $0.50 home game
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          House Game Poker Trainer
        </h1>
        <p className="mt-4 text-white/70">
          Exploitative Texas Hold&apos;em practice against loose, passive recreational players:
          limpers who never fold, calling stations who pay off top pair, and the occasional maniac.
          Play the hand, get graded on the decision rather than the result, and learn why.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {PHASES.map((phase) => (
          <li
            key={phase.name}
            className="flex items-center justify-between rounded-lg bg-black/20 px-4 py-3 ring-1 ring-white/10"
          >
            <span className="text-sm text-white/80">
              <span className="font-semibold text-white">{phase.name}</span> — {phase.title}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${STATUS_STYLES[phase.status]}`}
            >
              {phase.status === "done" ? "done" : phase.status === "next" ? "up next" : "planned"}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-sm text-white/50">
        The poker engine, opponent model and equity simulator are finished and under test. The table
        arrives in phase 2; until then, <code className="text-white/70">npm run sim</code> deals
        hands in the terminal.
      </p>
    </main>
  );
}
