
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea'; // Added Textarea
import { Trash2, CalendarDays, StickyNote } from 'lucide-react'; // Added StickyNote
import type { DayOfWeek, Item, DayPlanData } from '@/types';

interface DayCardProps {
  day: DayOfWeek;
  dayData: DayPlanData;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void;
}

const DayCard: FC<DayCardProps> = ({ day, dayData, allItems, onUpdateDayData }) => {
  const handleItemSelectChange = (itemId: string) => {
    if (itemId === "none" || itemId === "") {
      onUpdateDayData(day, { item: null });
    } else {
      const selectedItem = allItems.find(item => item.id === itemId);
      onUpdateDayData(day, { item: selectedItem || null });
    }
  };

  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateDayData(day, { note: event.target.value });
  };

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center">
           <CalendarDays className="mr-2 h-5 w-5 text-primary opacity-70" />
          {day}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        <div>
            <Select
            value={dayData.item?.id || ""}
            onValueChange={handleItemSelectChange}
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
            {dayData.item && (
            <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdateDayData(day, { item: null })}
                className="w-full text-destructive hover:text-destructive button-no-print mt-1"
                aria-label={`Clear item for ${day}`}
            >
                <Trash2 className="mr-2 h-4 w-4" /> Clear Item
            </Button>
            )}
        </div>
        
        <div className="space-y-1 day-card-note-area">
          <label htmlFor={`note-${day}`} className="text-xs font-medium text-muted-foreground flex items-center">
            <StickyNote className="mr-1 h-3 w-3" />
            Note / Event:
          </label>
          <Textarea
            id={`note-${day}`}
            placeholder="E.g., BBQ at park, Guests over..."
            value={dayData.note}
            onChange={handleNoteChange}
            rows={2}
            className="text-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DayCard;
