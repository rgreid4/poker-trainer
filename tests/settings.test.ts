import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  SETTINGS_STORAGE_KEY,
  SPEED_FAST,
  SPEED_NORMAL,
  type StoredSettings,
  loadSettings,
  sanitizeSettings,
  saveSettings,
} from "@/lib/settings";

const defaults: StoredSettings = {
  tableSize: 6,
  showProfiles: true,
  speedMs: SPEED_NORMAL,
  mode: "full",
  detail: "simple",
};

describe("settings validation", () => {
  it("keeps valid values", () => {
    const stored: StoredSettings = {
      tableSize: 9,
      showProfiles: false,
      speedMs: SPEED_FAST,
      mode: "iso",
      detail: "full",
    };
    expect(sanitizeSettings(stored, defaults)).toEqual(stored);
  });

  it("falls back on nonsense rather than breaking the table", () => {
    expect(sanitizeSettings(null, defaults)).toEqual(defaults);
    expect(sanitizeSettings({ tableSize: 47 }, defaults).tableSize).toBe(6);
    expect(sanitizeSettings({ tableSize: 1 }, defaults).tableSize).toBe(6);
    expect(sanitizeSettings({ tableSize: 2 }, defaults).tableSize).toBe(2);
    expect(sanitizeSettings({ speedMs: 9999 }, defaults).speedMs).toBe(SPEED_NORMAL);
    expect(sanitizeSettings({ mode: "not-a-mode" as "iso" }, defaults).mode).toBe("full");
    expect(sanitizeSettings({ showProfiles: "yes" as unknown as boolean }, defaults).showProfiles).toBe(
      true,
    );
  });
});

describe("settings persistence", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("round-trips the settings a player chose", () => {
    saveSettings({
      tableSize: 4,
      showProfiles: false,
      speedMs: SPEED_FAST,
      mode: "draws",
      detail: "full",
    });
    expect(loadSettings(defaults)).toEqual({
      tableSize: 4,
      showProfiles: false,
      speedMs: SPEED_FAST,
      mode: "draws",
      detail: "full",
    });
  });

  it("uses the defaults when nothing is stored or the stored value is corrupt", () => {
    expect(loadSettings(defaults)).toEqual(defaults);
    store.set(SETTINGS_STORAGE_KEY, "{{{");
    expect(loadSettings(defaults)).toEqual(defaults);
  });
});
