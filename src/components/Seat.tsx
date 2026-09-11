import { PROFILES } from "@/data/profileTendencies";
import { shortAction } from "@/lib/handLog";
import { formatMoney } from "@/lib/money";
import type { ActionRecord, HandState } from "@/lib/types";
import { CardRow } from "./PlayingCard";

export interface SeatProps {
  state: HandState;
  seat: number;
  showProfiles: boolean;
  lastAction?: ActionRecord;
  isWinner: boolean;
}

export function Seat({ state, seat, showProfiles, lastAction, isWinner }: SeatProps) {
  const player = state.players[seat];
  const position = state.positions[seat];
  const isActing = state.actingSeat === seat;
  const folded = player.status === "folded";
  const profile = player.isHero ? null : PROFILES[player.profile as "station"];
  const showCards = player.isHero || player.revealed;

  // Widths and type scale follow the table container, not the viewport, so a
  // narrow phone gets a proportionally smaller table rather than a broken one.
  return (
    <div
      className={`flex w-[4.5rem] flex-col items-center gap-0.5 transition-opacity duration-200 @min-[560px]:w-32 @min-[560px]:gap-1 ${
        folded ? "opacity-40" : "opacity-100"
      }`}
    >
      <div className="flex gap-1">
        {player.hole.length > 0 ? (
          <CardRow
            cards={player.hole}
            hidden={!showCards}
            size={player.isHero ? "md" : "sm"}
            dimmed={folded}
          />
        ) : null}
      </div>

      <div
        className={`w-full rounded-md px-1 py-0.5 text-center ring-1 backdrop-blur-sm transition-all duration-200 @min-[560px]:rounded-lg @min-[560px]:px-2 @min-[560px]:py-1 ${
          isWinner
            ? "bg-amber-400/25 ring-amber-300/70"
            : isActing
              ? "bg-emerald-400/20 ring-emerald-300/70 shadow-lg shadow-emerald-500/20"
              : "bg-black/45 ring-white/15"
        }`}
      >
        <div className="flex items-center justify-center gap-0.5 @min-[560px]:gap-1">
          <span className="truncate text-[0.6rem] font-semibold text-white/95 @min-[560px]:text-xs">
            {player.name}
          </span>
          <span className="rounded bg-white/15 px-0.5 text-[0.5rem] font-bold tracking-wide text-white/80 @min-[560px]:px-1 @min-[560px]:text-[0.6rem]">
            {position}
          </span>
        </div>
        <div className="text-[0.6rem] tabular-nums text-emerald-200/90 @min-[560px]:text-xs">
          {player.status === "allin" && player.stack === 0 ? "all in" : formatMoney(player.stack)}
        </div>
        {showProfiles && profile ? (
          <div
            className={`mt-0.5 inline-flex items-center gap-0.5 rounded px-0.5 text-[0.5rem] font-medium ring-1 @min-[560px]:gap-1 @min-[560px]:px-1 @min-[560px]:py-px @min-[560px]:text-[0.6rem] ${profile.badgeClass}`}
            title={profile.blurb}
          >
            <span aria-hidden>{profile.icon}</span>
            {profile.badge}
          </div>
        ) : null}
      </div>

      <div className="h-4 @min-[560px]:h-5">
        {lastAction && !folded ? (
          <span className="animate-pop rounded-full bg-black/60 px-1 py-px text-[0.5rem] text-white/80 ring-1 ring-white/10 @min-[560px]:px-2 @min-[560px]:py-0.5 @min-[560px]:text-[0.65rem]">
            {shortAction(lastAction)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** The chips a player has pushed forward on the current street. */
export function BetChip({ amount }: { amount: number }) {
  if (amount <= 0) return null;
  return (
    <div className="animate-pop flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-300/30">
      <span
        className="h-2.5 w-2.5 rounded-full bg-gradient-to-br from-amber-300 to-amber-600 ring-1 ring-amber-900/50"
        aria-hidden
      />
      {formatMoney(amount)}
    </div>
  );
}

export function DealerButton() {
  return (
    <div
      className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[0.6rem] font-black text-neutral-900 shadow ring-1 ring-black/30"
      title="Dealer button"
    >
      D
    </div>
  );
}
