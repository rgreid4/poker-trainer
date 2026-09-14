"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type Rng, makeRng } from "@/lib/cards";
import { DEFAULT_SETTINGS, stepOpponent } from "@/lib/dealer";
import { type ActionInput, applyAction, isHandOver } from "@/lib/handEngine";
import { DEFAULT_MODE, practiceMode } from "@/lib/practice/modes";
import { type StoredSettings, SPEED_NORMAL, loadSettings, saveSettings } from "@/lib/settings";
import { setupPractice } from "@/lib/practice/spots";
import { type DecisionRecord, evaluateChoice } from "@/lib/strategy/decision";
import { EQUITY_ITERATIONS } from "@/data/thresholds";
import type { Cents } from "@/lib/money";
import type { HandState } from "@/lib/types";

/** Table and practice settings, persisted to localStorage between sessions. */
export type TrainerSettings = StoredSettings;

export const DEFAULT_TRAINER_SETTINGS: TrainerSettings = {
  tableSize: 6,
  showProfiles: true,
  speedMs: SPEED_NORMAL,
  mode: DEFAULT_MODE,
};

export interface UseTrainerOptions {
  initialSettings?: Partial<TrainerSettings>;
  onDecision?: (record: DecisionRecord) => void;
  /** Called once per finished hand. `net` is undefined for drills. */
  onHandComplete?: (net?: Cents) => void;
}

export interface Trainer {
  state: HandState | null;
  settings: TrainerSettings;
  setSettings: (update: Partial<TrainerSettings>) => void;
  /** True while the hero has a decision in front of them. */
  isHeroTurn: boolean;
  /** True when the hand is over, or the drill has had its one decision. */
  handOver: boolean;
  handNumber: number;
  /** Every graded hero decision in the current hand. */
  decisions: DecisionRecord[];
  /** The most recent graded decision, shown in the feedback panel. */
  feedback: DecisionRecord | null;
  /** True when a drill could not build its situation and dealt a normal hand. */
  spotFallback: boolean;
  act: (action: ActionInput) => void;
  deal: () => void;
}

export function useTrainer(options: UseTrainerOptions = {}): Trainer {
  // Read straight out of storage on the first client render. The table itself
  // is not rendered until after mount, so this cannot desync hydration.
  const [settings, setSettingsState] = useState<TrainerSettings>(() =>
    loadSettings({ ...DEFAULT_TRAINER_SETTINGS, ...options.initialSettings }),
  );
  const [state, setState] = useState<HandState | null>(null);
  const [handNumber, setHandNumber] = useState(0);
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [feedback, setFeedback] = useState<DecisionRecord | null>(null);
  const [spotFallback, setSpotFallback] = useState(false);
  const [drillDone, setDrillDone] = useState(false);

  const rngRef = useRef<Rng | null>(null);
  // A separate stream for the equity simulator, so grading never disturbs the
  // sequence of cards the table is dealt.
  const strategyRngRef = useRef<Rng | null>(null);
  const countedHandRef = useRef(0);

  // Callbacks live in refs so a new function identity never re-deals the hand.
  const onDecisionRef = useRef(options.onDecision);
  const onHandCompleteRef = useRef(options.onHandComplete);
  onDecisionRef.current = options.onDecision;
  onHandCompleteRef.current = options.onHandComplete;

  const { tableSize, mode, speedMs } = settings;

  const deal = useCallback(() => {
    // Seeded on the client only, so the server-rendered markup stays stable.
    if (!rngRef.current) rngRef.current = makeRng((Date.now() ^ 0x5f3759df) >>> 0);
    if (!strategyRngRef.current) strategyRngRef.current = makeRng(0x9e3779b9);

    const setup = setupPractice(mode, rngRef.current, {
      ...DEFAULT_SETTINGS,
      tableSize,
    });

    setState(setup.state);
    setSpotFallback(setup.fallback);
    setDecisions([]);
    setFeedback(null);
    setDrillDone(false);
    setHandNumber((n) => n + 1);
  }, [mode, tableSize]);

  // Deal the first hand once mounted, and a fresh one whenever the table or
  // the practice mode changes.
  useEffect(() => {
    deal();
  }, [deal]);

  const isHeroTurn = Boolean(
    state &&
      !drillDone &&
      !isHandOver(state) &&
      state.actingSeat !== null &&
      state.players[state.actingSeat].isHero,
  );

  const handOver = Boolean(state && (isHandOver(state) || drillDone));

  // Opponents act on a timer so the table reads like a real hand rather than
  // resolving instantly.
  useEffect(() => {
    if (!state || drillDone || isHandOver(state) || state.actingSeat === null) return;
    if (state.players[state.actingSeat].isHero) return;

    const timer = setTimeout(() => {
      setState((current) => {
        if (!current || isHandOver(current) || current.actingSeat === null) return current;
        if (current.players[current.actingSeat].isHero) return current;
        return stepOpponent(current, rngRef.current as Rng);
      });
    }, speedMs);

    return () => clearTimeout(timer);
  }, [state, speedMs, drillDone]);

  // Count each finished hand exactly once.
  useEffect(() => {
    if (!state || !handOver) return;
    if (countedHandRef.current === handNumber) return;
    countedHandRef.current = handNumber;
    const net =
      isHandOver(state) && state.result
        ? state.result.net[state.config.heroSeat]
        : undefined;
    onHandCompleteRef.current?.(net);
  }, [state, handOver, handNumber]);

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
        practiceMode(mode).kind === "preflop" ? EQUITY_ITERATIONS.drill : EQUITY_ITERATIONS.full,
      );
      setDecisions((prev) => [...prev, record]);
      setFeedback(record);
      onDecisionRef.current?.(record);

      setState(applyAction(state, action));
      // The preflop drill is one decision per hand: grade it and move on.
      if (practiceMode(mode).kind === "preflop") setDrillDone(true);
    },
    [state, mode],
  );

  const setSettings = useCallback((update: Partial<TrainerSettings>) => {
    setSettingsState((current) => ({ ...current, ...update }));
  }, []);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  return useMemo(
    () => ({
      state,
      settings,
      setSettings,
      isHeroTurn,
      handOver,
      handNumber,
      decisions,
      feedback,
      spotFallback,
      act,
      deal,
    }),
    [
      state,
      settings,
      setSettings,
      isHeroTurn,
      handOver,
      handNumber,
      decisions,
      feedback,
      spotFallback,
      act,
      deal,
    ],
  );
}
