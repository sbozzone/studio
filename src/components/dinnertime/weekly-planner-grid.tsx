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

const WeeklyPlannerGrid: FC<WeeklyPlannerGridProps> = ({ plan, allItems, onUpdateDayData, orderedDays }) => {
  return (
    <Card className="shadow-xl animate-fade-up">
      <CardHeader className="pb-3">
        <CardTitle className="font-headline text-xl md:text-2xl lg:text-3xl text-center flex items-center justify-center">
          <NotebookText className="mr-3 h-6 w-6 md:h-8 md:w-8 text-primary" />
          Your Weekly Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 md:px-6 md:pb-6">
        {/*
         * Grid columns:
         *   mobile (< sm): 1 column — full-width cards for easy scrolling
         *   sm (≥ 640px):  2 columns
         *   lg (≥ 1024px): 3 columns
         *   xl (≥ 1280px): 4 columns
         *
         * gap-3 on mobile keeps cards close; gap-4 on larger screens adds breathing room.
         */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          {orderedDays.map(day => (
            <DayCard
              key={day}
              day={day}
              dayData={plan[day]}
              allItems={allItems}
              onUpdateDayData={onUpdateDayData}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlannerGrid;
