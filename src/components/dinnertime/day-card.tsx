
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, CalendarDays } from 'lucide-react';
import type { DayOfWeek, Item } from '@/types';

interface DayCardProps {
  day: DayOfWeek;
  plannedItem: Item | null;
  allItems: Item[];
  onAssignItem: (day: DayOfWeek, item: Item | null) => void;
}

const DayCard: FC<DayCardProps> = ({ day, plannedItem, allItems, onAssignItem }) => {
  const handleValueChange = (itemId: string) => {
    if (itemId === "none" || itemId === "") {
      onAssignItem(day, null);
    } else {
      const selectedItem = allItems.find(item => item.id === itemId);
      onAssignItem(day, selectedItem || null);
    }
  };

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
          value={plannedItem?.id || ""}
          onValueChange={handleValueChange}
          className="day-card-select"
        >
          <SelectTrigger aria-label={`Select item for ${day}`} className="day-card-select-trigger">
            <SelectValue placeholder="Select an item..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Not Planned --</SelectItem>
            {allItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name} ({item.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {plannedItem && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAssignItem(day, null)}
            className="w-full text-destructive hover:text-destructive button-no-print"
            aria-label={`Clear item for ${day}`}
          >
            <Trash2 className="mr-2 h-4 w-4" /> Clear
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default DayCard;
