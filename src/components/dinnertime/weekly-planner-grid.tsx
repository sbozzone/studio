
"use client";

import type { FC } from 'react';
import DayCard from './day-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayOfWeek, WeeklyPlan, Item, DayPlanData, DailyWeather } from '@/types';
import { NotebookText, Loader2 } from 'lucide-react';

interface WeeklyPlannerGridProps {
  plan: WeeklyPlan;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void;
  orderedDays: DayOfWeek[];
  weatherForecast: DailyWeather[] | null;
  isLoadingWeather: boolean;
}

const WeeklyPlannerGrid: FC<WeeklyPlannerGridProps> = ({ plan, allItems, onUpdateDayData, orderedDays, weatherForecast, isLoadingWeather }) => {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-3xl text-center flex items-center justify-center">
          <NotebookText className="mr-3 h-8 w-8 text-primary" />
          Your Weekly Plan
        </CardTitle>
        {isLoadingWeather && (
          <div className="flex items-center justify-center text-sm text-muted-foreground mt-2">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Fetching weather...
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orderedDays.map((day, index) => (
            <DayCard
              key={day}
              day={day}
              dayData={plan[day]}
              allItems={allItems}
              onUpdateDayData={onUpdateDayData}
              dailyWeather={weatherForecast ? weatherForecast[index] : undefined}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlannerGrid;
