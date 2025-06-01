
"use client";

import type { FC } from 'react';
import DayCard from './day-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayOfWeek, WeeklyPlan, Item, DayPlanData } from '@/types';
import { NotebookText } from 'lucide-react';

interface WeeklyPlannerGridProps {
  plan: WeeklyPlan;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void; // Changed prop name
  orderedDays: DayOfWeek[];
}

const WeeklyPlannerGrid: FC<WeeklyPlannerGridProps> = ({ plan, allItems, onUpdateDayData, orderedDays }) => {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-3xl text-center flex items-center justify-center">
          <NotebookText className="mr-3 h-8 w-8 text-primary" />
          Your Weekly Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {orderedDays.map((day) => (
            <DayCard
              key={day}
              day={day}
              dayData={plan[day]} // Pass the whole dayData object
              allItems={allItems}
              onUpdateDayData={onUpdateDayData} // Pass the updated handler
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlannerGrid;
