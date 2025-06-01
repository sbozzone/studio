
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

// Weather Related Types
export interface DailyWeather {
  date: string;
  weatherCode: number;
  maxTemp: number;
  description: string;
  icon: React.ElementType; // Lucide icon component
}

export interface ApiWeatherResponseDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
}

export interface ApiWeatherResponse {
  latitude: number;
  longitude: number;
  daily: ApiWeatherResponseDaily;
}

// Manual Grocery Item
export interface ManualGroceryItem {
  id: string;
  name: string;
}

