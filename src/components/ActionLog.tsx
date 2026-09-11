import { cardsToString } from "@/lib/cards";
import { groupedHistory } from "@/lib/handLog";
import { formatMoney } from "@/lib/money";
import type { HandState } from "@/lib/types";

const BOARD_AT_STREET: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5 };

export function ActionLog({ state }: { state: HandState }) {
  const groups = groupedHistory(state);

  return (
    <div className="flex h-full flex-col rounded-xl bg-black/35 p-3 ring-1 ring-white/10">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
        Hand history
      </h2>
      <ol className="flex-1 space-y-2 overflow-y-auto text-xs text-white/75">
        {groups.map((group) => {
          const cardCount = BOARD_AT_STREET[group.street] ?? 0;
          const board = state.board.slice(0, cardCount);
          return (
            <li key={group.street}>
              <div className="flex items-baseline gap-2">
                <span className="text-[0.65rem] font-bold uppercase tracking-wider text-emerald-300/80">
                  {group.label}
                </span>
                {board.length > 0 ? (
                  <span className="font-mono text-[0.65rem] text-white/45">
                    {cardsToString(board)}
                  </span>
                ) : null}
              </div>
              <ul className="mt-0.5 space-y-0.5 pl-2">
                {group.lines.map((line, i) => (
                  <li key={i} className="border-l border-white/10 pl-2">
                    {line}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
        {groups.length === 0 ? <li className="text-white/40">Blinds are in. Your move.</li> : null}
      </ol>

      {state.result ? (
        <div className="mt-2 border-t border-white/10 pt-2 text-xs">
          <div className="font-semibold text-amber-200">
            Pot {formatMoney(state.result.finalPot)}
          </div>
          {state.result.showdown.length > 0 ? (
            <ul className="mt-1 space-y-0.5 text-white/70">
              {state.result.showdown.map((entry) => (
                <li key={entry.seat}>
                  {state.players[entry.seat].name}: {entry.description}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
