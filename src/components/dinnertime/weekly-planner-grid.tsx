
"use client";

import type { FC } from 'react';
import DayCard from './day-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayOfWeek, WeeklyPlan, Item, DayPlanData } from '@/types';
import { NotebookText, Loader2 } from 'lucide-react';

interface WeeklyPlannerGridProps {
  plan: WeeklyPlan;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void;
  orderedDays: DayOfWeek[];
}

const WeeklyPlannerGrid: FC<WeeklyPlannerGridProps> = ({ plan, allItems, onUpdateDayData, orderedDays }) => {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl md:text-3xl text-center flex items-center justify-center">
          <NotebookText className="mr-3 h-8 w-8 text-primary" />
          Your Weekly Plan
        </CardTitle>
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
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlannerGrid;
