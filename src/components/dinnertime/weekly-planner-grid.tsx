
"use client";

import type { FC } from 'react';
import DayCard from './day-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayOfWeek, WeeklyPlan, Item } from '@/types';
// import { DAYS_OF_WEEK } from '@/types'; // No longer needed here
import { NotebookText } from 'lucide-react';

interface WeeklyPlannerGridProps {
  plan: WeeklyPlan;
  allItems: Item[];
  onUpdatePlan: (day: DayOfWeek, item: Item | null) => void;
  orderedDays: DayOfWeek[]; // New prop for ordered days
}

const WeeklyPlannerGrid: FC<WeeklyPlannerGridProps> = ({ plan, allItems, onUpdatePlan, orderedDays }) => {
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
          {orderedDays.map((day) => ( // Use orderedDays for mapping
            <DayCard
              key={day}
              day={day}
              plannedItem={plan[day]}
              allItems={allItems}
              onAssignItem={onUpdatePlan}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlannerGrid;
