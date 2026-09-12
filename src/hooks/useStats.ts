"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cents } from "@/lib/money";
import {
  type StatsSnapshot,
  clearStats,
  emptyStats,
  loadStats,
  recordDecision,
  recordHand,
  saveStats,
} from "@/lib/stats";
import type { DecisionRecord } from "@/lib/strategy/decision";

export interface StatsStore {
  stats: StatsSnapshot;
  /** False until localStorage has been read, which only happens on the client. */
  loaded: boolean;
  addDecision: (record: DecisionRecord) => void;
  addHand: (net?: Cents) => void;
  reset: () => void;
}

/** Progress tracking, persisted to localStorage. */
export function useStats(): StatsStore {
  const [stats, setStats] = useState<StatsSnapshot>(() => emptyStats());
  const [loaded, setLoaded] = useState(false);

  // Read once on mount so the server-rendered markup does not depend on storage.
  useEffect(() => {
    setStats(loadStats());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveStats(stats);
  }, [stats, loaded]);

  const addDecision = useCallback((record: DecisionRecord) => {
    setStats((current) => recordDecision(current, record));
  }, []);

  const addHand = useCallback((net?: Cents) => {
    setStats((current) => recordHand(current, net));
  }, []);

  const reset = useCallback(() => {
    clearStats();
    setStats(emptyStats());
  }, []);

  return useMemo(
    () => ({ stats, loaded, addDecision, addHand, reset }),
    [stats, loaded, addDecision, addHand, reset],
  );
}
