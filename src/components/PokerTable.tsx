import { latestActionBySeat } from "@/lib/handLog";
import { potNow } from "@/lib/handEngine";
import { formatMoneyWithBB } from "@/lib/money";
import type { HandState } from "@/lib/types";
import { CardRow } from "./PlayingCard";
import { BetChip, DealerButton, Seat } from "./Seat";

/** Where a seat sits on the oval, as a percentage of the table box. */
function seatPosition(index: number, count: number, radiusX: number, radiusY: number) {
  // The hero is index 0 and sits at the bottom; seats run clockwise from there.
  const angle = (Math.PI / 2) + (index / count) * Math.PI * 2;
  return {
    left: `${50 + radiusX * Math.cos(angle)}%`,
    top: `${50 + radiusY * Math.sin(angle)}%`,
  };
}

export interface PokerTableProps {
  state: HandState;
  showProfiles: boolean;
}

export function PokerTable({ state, showProfiles }: PokerTableProps) {
  const { tableSize, heroSeat, buttonSeat, bigBlind } = state.config;

  const lastActions = latestActionBySeat(state);
  const pot = potNow(state);
  const winners = new Set(state.result?.pots.flatMap((p) => p.winners) ?? []);

  // Seats are laid out relative to the hero so the hero is always at the bottom.
  const seatOrder = Array.from({ length: tableSize }, (_, i) => (heroSeat + i) % tableSize);

  return (
    // Squarer on a phone so nine seats have somewhere to go.
    <div className="@container relative mx-auto aspect-square w-full max-w-4xl @min-[420px]:aspect-[6/5] @min-[560px]:aspect-[7/5]">
      {/* Rail and felt */}
      <div className="absolute inset-[5%] rounded-[50%] bg-gradient-to-b from-[#4a3524] to-[#2b1d13] shadow-[0_10px_30px_rgba(0,0,0,0.45)] ring-1 ring-black/40" />
      <div className="absolute inset-[8.5%] rounded-[50%] bg-[radial-gradient(ellipse_at_50%_35%,#1c6b4b_0%,#12513a_55%,#0c3b2a_100%)] shadow-[inset_0_0_60px_rgba(0,0,0,0.5)] ring-1 ring-black/30" />
      <div className="absolute inset-[10%] rounded-[50%] ring-1 ring-white/10" />

      {/* Middle of the table: pot, board, street */}
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        <div className="rounded-full bg-black/45 px-2 py-0.5 text-center ring-1 ring-white/10 @min-[560px]:px-3 @min-[560px]:py-1">
          <span className="text-[0.55rem] uppercase tracking-widest text-white/50 @min-[560px]:text-[0.65rem]">
            Pot
          </span>{" "}
          <span className="text-xs font-bold tabular-nums text-amber-200 @min-[560px]:text-sm">
            {formatMoneyWithBB(state.result ? state.result.finalPot : pot, bigBlind)}
          </span>
        </div>

        <div className="flex min-h-11 items-center gap-0.5 @min-[560px]:min-h-16 @min-[560px]:gap-1">
          {state.board.length > 0 ? (
            // Only the flop is dealt as a run of three; later cards land at once.
            <CardRow cards={state.board} size="md" stagger={state.board.length === 3 ? 70 : 0} />
          ) : (
            <span className="text-[0.6rem] uppercase tracking-[0.3em] text-white/25 @min-[560px]:text-xs">
              preflop
            </span>
          )}
        </div>
      </div>

      {/* Seats */}
      {seatOrder.map((seat, index) => {
        const player = state.players[seat];
        const seatStyle = seatPosition(index, tableSize, 42, 41);
        const chipStyle = seatPosition(index, tableSize, 26, 24);
        const buttonStyle = seatPosition(index, tableSize, 33, 31);
        return (
          <div key={seat}>
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={seatStyle}
            >
              <Seat
                state={state}
                seat={seat}
                showProfiles={showProfiles}
                lastAction={lastActions[seat]}
                isWinner={winners.has(seat)}
              />
            </div>

            <div
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
              style={chipStyle}
            >
              <BetChip amount={player.committed} />
            </div>

            {seat === buttonSeat ? (
              <div
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={buttonStyle}
              >
                <DealerButton />
              </div>
            ) : null}
          </div>
        );
      })}

    </div>
  );
}
