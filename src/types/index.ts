
export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type ItemType = 'entree' | 'side';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
}

export interface DayPlanData {
  entree: Item | null;
  side1: Item | null;
  side2: Item | null;
  note: string;
}

export type WeeklyPlan = Record<DayOfWeek, DayPlanData>;

// Manual Grocery Item
export interface ManualGroceryItem {
  id: string;
  name: string;
}
