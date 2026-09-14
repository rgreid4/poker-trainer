"use client";

import { PROFILES } from "@/data/profileTendencies";
import { CONCEPTS, CONCEPT_IDS } from "@/lib/strategy/concepts";
import { GRADE_LABELS, GRADE_ORDER, GRADE_STYLES } from "@/lib/strategy/grade";

const POSITIONS: Array<{ name: string; when: string; play: string }> = [
  {
    name: "UTG / UTG+1 / UTG+2",
    when: "First to act before the flop",
    play: "Tightest range. Everyone acts after you on every street.",
  },
  {
    name: "MP / HJ",
    when: "Middle of the table",
    play: "A little wider. Still several players left behind you.",
  },
  {
    name: "CO",
    when: "One seat right of the button",
    play: "Wide. Raise to isolate limpers and to buy the button.",
  },
  {
    name: "BTN",
    when: "The dealer button",
    play: "Widest. You act last on the flop, turn and river — the best seat at the table.",
  },
  {
    name: "SB",
    when: "Posts the small blind",
    play: "Acts first after the flop with money already in. Play tight and avoid calling.",
  },
  {
    name: "BB",
    when: "Posts the big blind",
    play: "Gets a discount to call, but plays every street out of position.",
  },
];

const HOUSE_RULES: Array<{ rule: string; why: string }> = [
  {
    rule: "Play tighter than the table",
    why: "They play 40 to 60% of hands. Folding the junk they play is the simplest edge you have.",
  },
  {
    rule: "Raise instead of limping",
    why: "Limping gives up the lead and invites the whole table. If a hand is worth playing, it is worth raising.",
  },
  {
    rule: "Isolate limpers, and size up",
    why: "Three big blinds plus one per limper, bigger still against players who cannot fold. They call anyway, so the raise is value, not a steal.",
  },
  {
    rule: "Value bet bigger and thinner",
    why: "Top pair with a decent kicker is a strong hand here. Bet three quarters of the pot or more, and bet hands you would check against good players.",
  },
  {
    rule: "Bluff far less",
    why: "A bluff needs a fold. Against a calling station, and in any multiway pot, betting with nothing simply donates money.",
  },
  {
    rule: "Charge the draws",
    why: "These players chase any draw at any price. Make the price high rather than giving free cards.",
  },
  {
    rule: "Respect sudden aggression",
    why: "When someone who has called all night raises or fires big on the turn or river, they have it. Fold your bluff-catchers, top pair included.",
  },
  {
    rule: "Never slow-play",
    why: "Trapping works against opponents who bet for you. These will pay you off instead, so bet your big hands.",
  },
  {
    rule: "Respect the crowd",
    why: "Every extra player makes one pair worse. Multiway, you want hands that make straights, flushes and sets.",
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5 rounded-xl bg-black/40 p-4 ring-1 ring-white/10">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold tracking-tight">How this trainer works</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-emerald-600/80 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-emerald-300/40 transition hover:bg-emerald-500"
        >
          Back to the table
        </button>
      </header>

      <p className="text-xs leading-relaxed text-white/70">
        This trainer is built for one specific game: a loose $0.25/$0.50 home game where most
        players see too many flops, limp instead of raising, call far too often and almost never
        bluff. It teaches the <span className="text-white/90">exploitative</span> adjustments that
        win the most money against that table. It is not teaching balanced or GTO poker, and it
        flags the spots where its advice would be a leak against strong players.
      </p>

      <Section title="Grading">
        <p className="text-xs leading-relaxed text-white/70">
          Every decision is scored against the best available play and graded on the gap. Grades
          describe the <span className="text-white/90">decision</span>, never the result: loose
          players hit lucky rivers constantly, and a correct call that loses is still correct.
        </p>
        <ul className="flex flex-col gap-1.5">
          {GRADE_ORDER.map((grade) => (
            <li key={grade} className="flex items-center gap-2 text-xs">
              <span
                className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[0.7rem] font-bold uppercase ring-1 ${GRADE_STYLES[grade]}`}
              >
                {GRADE_LABELS[grade]}
              </span>
              <span className="text-white/65">
                {grade === "best"
                  ? "The play the engine would make."
                  : grade === "good"
                    ? "Within a hair of the best play. No real cost."
                    : grade === "acceptable"
                      ? "Defensible, but it gives up a little."
                      : grade === "mistake"
                        ? "A clear error that costs money over time."
                        : "A serious error, usually folding a big hand or paying off with nothing."}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-white/50">
          When two plays score within a hair of each other, the trainer says the spot is close and
          marks both as fine rather than pretending one is right.
        </p>
      </Section>

      <Section title="The opponents">
        <ul className="flex flex-col gap-2">
          {Object.values(PROFILES).map((profile) => (
            <li key={profile.id} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold ring-1 ${profile.badgeClass}`}
              >
                <span aria-hidden>{profile.icon}</span>
                {profile.badge}
              </span>
              <span>
                <span className="font-semibold text-white/90">{profile.name}</span>{" "}
                <span className="text-white/65">{profile.blurb}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs leading-relaxed text-white/50">
          Badges can be hidden from the header for a harder read. Their bet sizing carries the same
          tells as the real thing: a min-raise or a huge overbet from a passive player is strength,
          while a small stab is usually a weak made hand or a draw.
        </p>
      </Section>

      <Section title="Positions">
        <ul className="flex flex-col gap-1.5">
          {POSITIONS.map((position) => (
            <li key={position.name} className="text-xs">
              <span className="font-semibold text-white/90">{position.name}</span>
              <span className="text-white/40"> — {position.when}. </span>
              <span className="text-white/65">{position.play}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Pot odds and equity">
        <p className="text-xs leading-relaxed text-white/70">
          <span className="text-white/90">Pot odds</span> are the price of a call: to call $2 into a
          $6 pot you risk $2 to win $8, so you need 2 ÷ 8 = 25% equity to break even.{" "}
          <span className="text-white/90">Equity</span> is your share of the pot if all the cards
          ran out now, measured here by dealing a few thousand runouts against the hands the
          engine thinks each opponent can hold. Call when your equity beats the price, fold when it
          does not.
        </p>
        <p className="text-xs leading-relaxed text-white/70">
          Draws get a little extra credit for the money you win <em>after</em> you hit, which is
          worth more in this game than most, because these players cannot fold once they have a
          pair. <span className="text-white/90">SPR</span> — stack divided by pot — tells you how
          committed you are: under about 1.5, a strong hand is simply getting in.
        </p>
        <p className="text-xs leading-relaxed text-white/60">
          Open <span className="font-semibold text-white/85">Why?</span> under any graded decision
          to see the working: how many runouts were simulated, how they finished, and the exact
          range each opponent was dealt from.
        </p>
      </Section>

      <Section title="Beating a loose home game">
        <ul className="flex flex-col gap-2">
          {HOUSE_RULES.map((item) => (
            <li key={item.rule} className="text-xs">
              <div className="font-semibold text-white/90">{item.rule}</div>
              <div className="text-white/60">{item.why}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Key concepts">
        <p className="text-xs text-white/50">
          Every graded decision is tagged with one of these, and the stats screen tracks your
          accuracy on each. A 🏠 marks the ones that are specific to this kind of game.
        </p>
        <ul className="flex flex-col gap-1.5">
          {CONCEPT_IDS.map((id) => (
            <li key={id} className="text-xs">
              <span className="font-semibold text-white/90">{CONCEPTS[id].name}</span>
              {CONCEPTS[id].houseGameSpecific ? <span aria-label="house game specific"> 🏠</span> : null}
              <span className="text-white/40"> — </span>
              <span className="text-white/65">{CONCEPTS[id].blurb}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Practice modes">
        <p className="text-xs leading-relaxed text-white/70">
          <span className="text-white/90">Full hands</span> plays every street.{" "}
          <span className="text-white/90">Preflop drill</span> gives you one decision per hand for
          fast reps. The <span className="text-white/90">spot drills</span> deal until a particular
          situation comes up — isolating limpers, multiway pots, thin value, folding to passive
          aggression, draws with callers, short stacks — and hand you the decision. They deal real
          hands rather than building positions, so if a drill cannot produce its spot it says so
          instead of faking one.
        </p>
      </Section>

      <footer className="border-t border-white/10 pt-3 text-[0.7rem] leading-relaxed text-white/45">
        The recommendations are strong exploitative heuristics, not solver output. Stats are stored
        in this browser only. Everything runs locally — no account, no server, nothing leaves your
        machine.
      </footer>
    </div>
  );
}
