"use client";

import type { FC } from 'react';
import DayCard from './day-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DayOfWeek, WeeklyPlan } from '@/types';
import { DAYS_OF_WEEK } from '@/types';
import { NotebookText } from 'lucide-react';

interface WeeklyPlannerGridProps {
  plan: WeeklyPlan;
  allMeals: string[];
  onUpdatePlan: (day: DayOfWeek, mealName: string | null) => void;
}

const WeeklyPlannerGrid: FC<WeeklyPlannerGridProps> = ({ plan, allMeals, onUpdatePlan }) => {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-3xl text-center flex items-center justify-center">
          <NotebookText className="mr-3 h-8 w-8 text-primary" />
          Your Weekly Dinner Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {DAYS_OF_WEEK.map((day) => (
            <DayCard
              key={day}
              day={day}
              plannedMeal={plan[day]}
              allMeals={allMeals}
              onAssignMeal={onUpdatePlan}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyPlannerGrid;
