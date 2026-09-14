import { PRACTICE_MODES, type PracticeModeId } from "./practice/modes";
import { MAX_PLAYERS, MIN_PLAYERS } from "./table";

export const SETTINGS_STORAGE_KEY = "poker-trainer/settings/v1";

export interface StoredSettings {
  tableSize: number;
  showProfiles: boolean;
  speedMs: number;
  mode: PracticeModeId;
  /** How much feedback to show after each decision. */
  detail: "simple" | "full";
}

export const SPEED_NORMAL = 550;
export const SPEED_FAST = 180;

/**
 * Anything stored is user-editable text, so every field is validated on the way
 * back in and anything odd falls back to the default rather than breaking the
 * table.
 */
export function sanitizeSettings(
  input: Partial<StoredSettings> | null | undefined,
  defaults: StoredSettings,
): StoredSettings {
  if (!input) return defaults;

  const tableSize = Number(input.tableSize);
  const speedMs = Number(input.speedMs);
  const knownMode = PRACTICE_MODES.some((mode) => mode.id === input.mode);

  return {
    tableSize:
      Number.isFinite(tableSize) && tableSize >= MIN_PLAYERS && tableSize <= MAX_PLAYERS
        ? Math.round(tableSize)
        : defaults.tableSize,
    showProfiles:
      typeof input.showProfiles === "boolean" ? input.showProfiles : defaults.showProfiles,
    speedMs: speedMs === SPEED_FAST || speedMs === SPEED_NORMAL ? speedMs : defaults.speedMs,
    mode: knownMode ? (input.mode as PracticeModeId) : defaults.mode,
    detail: input.detail === "full" || input.detail === "simple" ? input.detail : defaults.detail,
  };
}

export function loadSettings(defaults: StoredSettings): StoredSettings {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    return sanitizeSettings(JSON.parse(raw) as Partial<StoredSettings>, defaults);
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: StoredSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage being unavailable must never stop the trainer working.
  }
}
