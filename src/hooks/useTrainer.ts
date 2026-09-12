"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Rng, makeRng } from "@/lib/cards";
import { DEFAULT_SETTINGS, startHand, stepOpponent } from "@/lib/dealer";
import { type ActionInput, applyAction, isHandOver } from "@/lib/handEngine";
import { type DecisionRecord, evaluateChoice } from "@/lib/strategy/decision";
import { EQUITY_ITERATIONS } from "@/data/thresholds";
import type { HandState } from "@/lib/types";

export interface TrainerSettings {
  tableSize: number;
  showProfiles: boolean;
  /** Pause between opponent actions, in milliseconds. */
  speedMs: number;
}

export const DEFAULT_TRAINER_SETTINGS: TrainerSettings = {
  tableSize: 6,
  showProfiles: true,
  speedMs: 550,
};

export interface Trainer {
  state: HandState | null;
  settings: TrainerSettings;
  setSettings: (update: Partial<TrainerSettings>) => void;
  /** True while the hero has a decision in front of them. */
  isHeroTurn: boolean;
  handOver: boolean;
  handNumber: number;
  /** Every graded hero decision in the current hand. */
  decisions: DecisionRecord[];
  /** The most recent graded decision, shown in the feedback panel. */
  feedback: DecisionRecord | null;
  act: (action: ActionInput) => void;
  deal: () => void;
}

export function useTrainer(initial: Partial<TrainerSettings> = {}): Trainer {
  const [settings, setSettingsState] = useState<TrainerSettings>({
    ...DEFAULT_TRAINER_SETTINGS,
    ...initial,
  });
  const [state, setState] = useState<HandState | null>(null);
  const [handNumber, setHandNumber] = useState(0);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [feedback, setFeedback] = useState<DecisionRecord | null>(null);
  const rngRef = useRef<Rng | null>(null);
  // A separate stream for the equity simulator, so grading never disturbs the
  // sequence of cards the table is dealt.
  const strategyRngRef = useRef<Rng | null>(null);

  const deal = useCallback(() => {
    // Seeded on the client only, so the server-rendered markup stays stable.
    if (!rngRef.current) rngRef.current = makeRng((Date.now() ^ 0x5f3759df) >>> 0);
    if (!strategyRngRef.current) strategyRngRef.current = makeRng(0x9e3779b9);
    setState(
      startHand({
        rng: rngRef.current,
        settings: { ...DEFAULT_SETTINGS, tableSize: settings.tableSize },
      }),
    );
    setDecisions([]);
    setFeedback(null);
    setHandNumber((n) => n + 1);
  }, [settings.tableSize]);

  // Deal the first hand once mounted, and a fresh one whenever the table changes.
  useEffect(() => {
    deal();
  }, [deal]);

  const isHeroTurn = Boolean(
    state && !isHandOver(state) && state.actingSeat !== null && state.players[state.actingSeat].isHero,
  );

  // Opponents act on a timer so the table reads like a real hand rather than
  // resolving instantly.
  useEffect(() => {
    if (!state || isHandOver(state) || state.actingSeat === null) return;
    if (state.players[state.actingSeat].isHero) return;

    const timer = setTimeout(() => {
      setState((current) => {
        if (!current || isHandOver(current) || current.actingSeat === null) return current;
        if (current.players[current.actingSeat].isHero) return current;
        return stepOpponent(current, rngRef.current as Rng);
      });
    }, settings.speedMs);

    return () => clearTimeout(timer);
  }, [state, settings.speedMs]);

  const act = useCallback(
    (action: ActionInput) => {
      if (!state || state.actingSeat === null) return;
      if (!state.players[state.actingSeat].isHero) return;

      // Grade against the state as it was before the action, so the engine
      // never sees the outcome it is being judged on.
      const { record } = evaluateChoice(
        state,
        action,
        strategyRngRef.current as Rng,
        EQUITY_ITERATIONS.full,
      );
      setDecisions((prev) => [...prev, record]);
      setFeedback(record);
      setState(applyAction(state, action));
    },
    [state],
  );

  const setSettings = useCallback((update: Partial<TrainerSettings>) => {
    setSettingsState((current) => ({ ...current, ...update }));
  }, []);

  return useMemo(
    () => ({
      state,
      settings,
      setSettings,
      isHeroTurn,
      handOver: Boolean(state && isHandOver(state)),
      handNumber,
      decisions,
      feedback,
      act,
      deal,
    }),
    [state, settings, setSettings, isHeroTurn, handNumber, decisions, feedback, act, deal],
  );
}
