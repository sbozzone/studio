/**
 * plan-utils.ts
 *
 * Shared utilities for working with the weekly dinner plan.
 * Extracted here so that page.tsx, settings/page.tsx, shopping-list.tsx,
 * and export-button.tsx all use the same logic rather than duplicating it.
 */

import type { DayOfWeek, WeeklyPlan, DayPlanData, Item, ItemType } from '@/types';
import { DAYS_OF_WEEK } from '@/types';

// ── Constants ──────────────────────────────────────────────────────────────────

/**
 * The note text used when the user picks "Screw It, let's eat out!".
 * Centralised here so every component references this constant instead of
 * a magic string literal.
 */
export const EAT_OUT_NOTE = "Screw It, let's eat out!";

// ── Plan factory ───────────────────────────────────────────────────────────────

/** Returns a fresh empty weekly plan (all slots null, no notes). */
export function createEmptyPlan(): WeeklyPlan {
  return DAYS_OF_WEEK.reduce((acc, day) => {
    acc[day] = { entree: null, side1: null, side2: null, note: '' };
    return acc;
  }, {} as WeeklyPlan);
}

// ── Day rotation ───────────────────────────────────────────────────────────────

/**
 * Returns the days of the week ordered so that today comes first.
 * Sunday (getDay() === 0) maps to index 6 in the Mon-first DAYS_OF_WEEK array.
 */
export function getRotatedDays(): DayOfWeek[] {
  const todayIndex = new Date().getDay();
  // Convert JS day (0=Sun) to Mon-first index (0=Mon … 6=Sun)
  const startIndex = todayIndex === 0 ? 6 : todayIndex - 1;
  return [
    ...DAYS_OF_WEEK.slice(startIndex),
    ...DAYS_OF_WEEK.slice(0, startIndex),
  ];
}

// ── Duplicate detection ────────────────────────────────────────────────────────

/**
 * Returns true if an item with the same name (case-insensitive) and type
 * already exists in `existingItems`. Pass `excludeId` to ignore a specific
 * item — useful when editing an item in place.
 */
export function isDuplicateItem(
  candidate: { name: string; type: ItemType },
  existingItems: Item[],
  excludeId?: string
): boolean {
  return existingItems.some(
    (item) =>
      item.id !== excludeId &&
      item.name.toLowerCase() === candidate.name.toLowerCase() &&
      item.type === candidate.type
  );
}

// ── Plan aggregation ───────────────────────────────────────────────────────────

/** Represents one row of the shopping list: a display label plus a usage count. */
export interface AggregatedPlanItem {
  /** e.g. "Chicken (entree)" */
  displayText: string;
  /** Number of days this item appears in the plan */
  count: number;
}

/**
 * Extracts every non-null item from all seven days of the plan,
 * deduplicates by (name, type), counts repeats, and returns a
 * sorted list ready to render as a shopping list.
 *
 * Used by both ShoppingList and ExportButton so they always agree.
 */
export function aggregatePlanItems(plan: WeeklyPlan): AggregatedPlanItem[] {
  // Collect every planned item across all days and slots
  const allItems: Item[] = [];
  Object.values(plan).forEach((dayData: DayPlanData) => {
    if (dayData.entree) allItems.push(dayData.entree);
    if (dayData.side1) allItems.push(dayData.side1);
    if (dayData.side2) allItems.push(dayData.side2);
  });

  // Count occurrences keyed by "Name (type)"
  const counts: Record<string, { count: number }> = {};
  allItems.forEach((item) => {
    const key = `${item.name} (${item.type})`;
    counts[key] = { count: (counts[key]?.count ?? 0) + 1 };
  });

  return Object.entries(counts)
    .map(([displayText, { count }]) => ({ displayText, count }))
    .sort((a, b) => a.displayText.localeCompare(b.displayText));
}

// ── Legacy data migration ──────────────────────────────────────────────────────

/**
 * Migrates any stored plan to the current 3-slot structure (entree, side1, side2).
 *
 * Handles three legacy formats that may exist in older localStorage data:
 *  1. Already-current: has `entree` / `side1` / `side2` keys → used as-is.
 *  2. Single `item` property → mapped to entree or side1 by type.
 *  3. Day data IS itself an Item object → mapped by type.
 *
 * Returns a fully-formed WeeklyPlan regardless of the input shape.
 */
export function migrateLegacyPlan(parsed: unknown): WeeklyPlan {
  const raw = parsed as Record<string, unknown>;

  return DAYS_OF_WEEK.reduce((acc, day) => {
    // Start with an empty day
    acc[day] = { entree: null, side1: null, side2: null, note: '' };

    const dayData = raw[day] as Record<string, unknown> | undefined;
    if (!dayData) return acc;

    if (
      Object.prototype.hasOwnProperty.call(dayData, 'entree') ||
      Object.prototype.hasOwnProperty.call(dayData, 'side1') ||
      Object.prototype.hasOwnProperty.call(dayData, 'side2')
    ) {
      // Format 1: current structure
      acc[day].entree = (dayData.entree as Item | null) ?? null;
      acc[day].side1 = (dayData.side1 as Item | null) ?? null;
      acc[day].side2 = (dayData.side2 as Item | null) ?? null;
      acc[day].note = (dayData.note as string) ?? '';
    } else if (Object.prototype.hasOwnProperty.call(dayData, 'item')) {
      // Format 2: legacy single `item` wrapper
      const oldItem = dayData.item as Item | null;
      if (oldItem?.type === 'entree') acc[day].entree = oldItem;
      else if (oldItem?.type === 'side') acc[day].side1 = oldItem;
      acc[day].note = (dayData.note as string) ?? '';
    } else if (
      Object.prototype.hasOwnProperty.call(dayData, 'id') &&
      Object.prototype.hasOwnProperty.call(dayData, 'name') &&
      Object.prototype.hasOwnProperty.call(dayData, 'type')
    ) {
      // Format 3: day data is itself an Item object (very old format)
      const oldItem = dayData as unknown as Item;
      if (oldItem.type === 'entree') acc[day].entree = oldItem;
      else if (oldItem.type === 'side') acc[day].side1 = oldItem;
    }

    return acc;
  }, {} as WeeklyPlan);
}
