"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, CalendarDays } from 'lucide-react';
import type { DayOfWeek } from '@/types';

interface DayCardProps {
  day: DayOfWeek;
  plannedMeal: string | null;
  allMeals: string[];
  onAssignMeal: (day: DayOfWeek, mealName: string | null) => void;
}

const DayCard: FC<DayCardProps> = ({ day, plannedMeal, allMeals, onAssignMeal }) => {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center">
           <CalendarDays className="mr-2 h-5 w-5 text-primary opacity-70" />
          {day}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-2">
        <Select
          value={plannedMeal || ""}
          onValueChange={(value) => onAssignMeal(day, value === "none" || value === "" ? null : value)}
        >
          <SelectTrigger aria-label={`Select meal for ${day}`}>
            <SelectValue placeholder="Select a meal..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Not Planned --</SelectItem>
            {allMeals.map((meal) => (
              <SelectItem key={meal} value={meal}>
                {meal}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {plannedMeal && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAssignMeal(day, null)}
            className="w-full text-destructive hover:text-destructive"
            aria-label={`Clear meal for ${day}`}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default DayCard;
