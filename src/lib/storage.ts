/**
 * storage.ts
 *
 * Centralizes all localStorage reads and writes for the app.
 * All storage keys are defined here as constants to prevent typos and
 * make it easy to find every place a value is persisted.
 *
 * Pattern:
 *  - Use `load*` functions on mount to hydrate state.
 *  - Use `save*` functions inside useEffect to persist state changes.
 *  - All functions are SSR-safe: they check for window before accessing localStorage.
 */

import type { Item, WeeklyPlan, ManualGroceryItem } from '@/types';

// ── Storage key constants ──────────────────────────────────────────────────────

export const STORAGE_KEYS = {
  items: 'dinnertime_items',
  weeklyPlan: 'dinnertime_weeklyPlan',
  familyName: 'dinnertime_familyName',
  customSubtitle: 'dinnertime_customSubtitle',
  manualGroceryItems: 'dinnertime_manualGroceryItems',
} as const;

// ── Generic helpers ────────────────────────────────────────────────────────────

/**
 * Reads a JSON value from localStorage. Returns `fallback` if:
 *  - We're on the server (no window)
 *  - The key doesn't exist
 *  - The stored JSON is malformed
 */
function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    console.error(`[storage] Failed to parse "${key}" from localStorage.`);
    return fallback;
  }
}

/**
 * Writes a value to localStorage as JSON.
 * No-ops on the server.
 */
function saveJson<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Reads a plain string from localStorage.
 * Returns `fallback` if the key is absent or we're on the server.
 */
function loadString(key: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = localStorage.getItem(key);
  return value !== null ? value : fallback;
}

// ── Typed accessors ────────────────────────────────────────────────────────────

export const loadItems = (): Item[] =>
  loadJson<Item[]>(STORAGE_KEYS.items, []);

export const saveItems = (items: Item[]): void =>
  saveJson(STORAGE_KEYS.items, items);

export const loadWeeklyPlanRaw = (): unknown =>
  loadJson<unknown>(STORAGE_KEYS.weeklyPlan, null);

export const saveWeeklyPlan = (plan: WeeklyPlan): void =>
  saveJson(STORAGE_KEYS.weeklyPlan, plan);

export const loadFamilyName = (): string =>
  loadString(STORAGE_KEYS.familyName, 'My');

export const saveFamilyName = (name: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.familyName, name);
};

export const loadCustomSubtitle = (defaultValue: string): string =>
  loadString(STORAGE_KEYS.customSubtitle, defaultValue);

export const saveCustomSubtitle = (subtitle: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.customSubtitle, subtitle);
};

export const loadManualGroceryItems = (): ManualGroceryItem[] =>
  loadJson<ManualGroceryItem[]>(STORAGE_KEYS.manualGroceryItems, []);

export const saveManualGroceryItems = (items: ManualGroceryItem[]): void =>
  saveJson(STORAGE_KEYS.manualGroceryItems, items);
