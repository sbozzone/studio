"use client";

import type { FC } from 'react';
import DayCard from './day-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayOfWeek, WeeklyPlan, Item, DayPlanData } from '@/types';
import { NotebookText } from 'lucide-react';

interface WeeklyPlannerGridProps {
  plan: WeeklyPlan;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void;
  orderedDays: DayOfWeek[];
}

/** Returns today's long-form weekday name, e.g. "Monday". */
function getTodayName(): DayOfWeek {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()) as DayOfWeek;
}

const WeeklyPlannerGrid: FC<WeeklyPlannerGridProps> = ({ plan, allItems, onUpdateDayData, orderedDays }) => {
  const todayName = getTodayName();

  return (
    <Card className="shadow-xl animate-fade-up transition-shadow duration-300 hover:shadow-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="font-headline text-xl md:text-2xl lg:text-3xl text-center flex items-center justify-center">
          <NotebookText className="mr-3 h-6 w-6 md:h-8 md:w-8 text-primary" />
          Your Weekly Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
        {/*
         * Each DayCard is wrapped in a div that carries:
         *   1. animate-fade-up  — the entrance keyframe
         *   2. animationDelay   — staggered so cards appear one after another
         *      (50 ms per card = 0 ms, 50 ms, 100 ms … 300 ms)
         *
         * The animation class on the inner DayCard itself was removed to avoid
         * doubling up — only the wrapper animates.
         */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {orderedDays.map((day, index) => (
            <div
              key={day}
              className="animate-fade-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <DayCard
                day={day}
                dayData={plan[day]}
                allItems={allItems}
                onUpdateDayData={onUpdateDayData}
                isToday={day === todayName}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlannerGrid;
