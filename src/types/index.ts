
export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export const DAYS_OF_WEEK: DayOfWeek[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type ItemType = 'entree' | 'side';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
}

export type WeeklyPlan = Record<DayOfWeek, Item | null>;
