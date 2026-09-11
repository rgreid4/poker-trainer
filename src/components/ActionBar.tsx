"use client";

import { legalActions } from "@/lib/betting";
import type { ActionInput } from "@/lib/handEngine";
import { formatBigBlinds, formatMoney } from "@/lib/money";
import type { HandState, LegalAction, SizingTag } from "@/lib/types";

const SIZING_LABELS: Partial<Record<SizingTag, string>> = {
  open: "open",
  iso: "isolate",
  threebet: "3-bet",
  min: "min",
  half: "½ pot",
  threequarter: "¾ pot",
  pot: "pot",
  allin: "all in",
};

function buttonLabel(action: LegalAction, bigBlind: number): { main: string; sub?: string } {
  switch (action.type) {
    case "fold":
      return { main: "Fold" };
    case "check":
      return { main: "Check" };
    case "call":
      return {
        main: `Call ${formatMoney(action.cost)}`,
        sub: action.allIn ? "all in" : formatBigBlinds(action.cost, bigBlind),
      };
    default: {
      const verb = action.type === "bet" ? "Bet" : "Raise to";
      return {
        main: action.allIn
          ? `All in ${formatMoney(action.to)}`
          : `${verb} ${formatMoney(action.to)}`,
        sub: action.allIn
          ? formatBigBlinds(action.to, bigBlind)
          : `${formatBigBlinds(action.to, bigBlind)} · ${SIZING_LABELS[action.sizing ?? "min"] ?? ""}`,
      };
    }
  }
}

const STYLES: Record<string, string> = {
  fold: "bg-rose-900/70 hover:bg-rose-800 ring-rose-400/30 text-rose-50",
  check: "bg-slate-700/80 hover:bg-slate-600 ring-white/20 text-white",
  call: "bg-sky-800/80 hover:bg-sky-700 ring-sky-300/30 text-sky-50",
  bet: "bg-emerald-700/85 hover:bg-emerald-600 ring-emerald-300/30 text-emerald-50",
  raise: "bg-emerald-700/85 hover:bg-emerald-600 ring-emerald-300/30 text-emerald-50",
};

export interface ActionBarProps {
  state: HandState;
  onAction: (action: ActionInput) => void;
  disabled?: boolean;
}

export function ActionBar({ state, onAction, disabled }: ActionBarProps) {
  const actions = legalActions(state);
  const { bigBlind } = state.config;

  return (
    <div className="flex flex-wrap items-stretch justify-center gap-2">
      {actions.map((action, index) => {
        const { main, sub } = buttonLabel(action, bigBlind);
        const style = action.allIn && action.type !== "call" ? "bg-amber-700/85 hover:bg-amber-600 ring-amber-300/40 text-amber-50" : STYLES[action.type];
        return (
          <button
            key={`${action.type}-${action.to}-${index}`}
            type="button"
            disabled={disabled}
            onClick={() => onAction({ type: action.type, to: action.to })}
            className={`min-w-24 flex-1 rounded-lg px-3 py-2 text-sm font-semibold ring-1 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-28 sm:flex-none ${style}`}
          >
            <span className="block leading-tight">{main}</span>
            {sub ? (
              <span className="block text-[0.65rem] font-normal tracking-wide opacity-70">
                {sub}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
