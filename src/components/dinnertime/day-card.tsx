
"use client";

import * as React from 'react'; // Added this line
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, CalendarDays, StickyNote, Thermometer, Salad, Beef, Utensils } from 'lucide-react';
import type { DayOfWeek, Item, DayPlanData, DailyWeather } from '@/types';
import { Label } from '@/components/ui/label';

interface DayCardProps {
  day: DayOfWeek;
  dayData: DayPlanData;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void;
  dailyWeather?: DailyWeather;
}

const DayCard: FC<DayCardProps> = ({ day, dayData, allItems, onUpdateDayData, dailyWeather }) => {
  const entreeItems = allItems.filter(item => item.type === 'entree');
  const sideItems = allItems.filter(item => item.type === 'side');

  const handleItemSelectChange = (itemSlot: 'entree' | 'side1' | 'side2', itemId: string) => {
    if (itemId === "none" || itemId === "") {
      onUpdateDayData(day, { [itemSlot]: null });
    } else {
      const selectedItem = allItems.find(item => item.id === itemId);
      onUpdateDayData(day, { [itemSlot]: selectedItem || null });
    }
  };

  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateDayData(day, { note: event.target.value });
  };

  const WeatherIcon = dailyWeather ? dailyWeather.icon : null;

  const createItemSelector = (
    slot: 'entree' | 'side1' | 'side2',
    label: string,
    icon: React.ElementType,
    placeholder: string,
    currentValue: Item | null,
    availableItems: Item[]
  ) => (
    <div className="space-y-1.5">
      <Label htmlFor={`${day}-${slot}`} className="text-xs font-medium text-muted-foreground flex items-center">
        {React.createElement(icon, { className: "mr-1.5 h-4 w-4 opacity-80"})}
        {label}:
      </Label>
      <div className="flex items-center gap-1">
        <Select
          value={currentValue?.id || ""}
          onValueChange={(itemId) => handleItemSelectChange(slot, itemId)}
          className="day-card-select flex-grow"
          name={`${day}-${slot}-select`}
          aria-label={`Select ${label.toLowerCase()} for ${day}`}
        >
          <SelectTrigger id={`${day}-${slot}`} className="day-card-select-trigger w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Not Planned --</SelectItem>
            {availableItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentValue && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUpdateDayData(day, { [slot]: null })}
            className="text-destructive hover:text-destructive button-no-print p-1 h-8 w-8 flex-shrink-0"
            aria-label={`Clear ${label.toLowerCase()} for ${day}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
  
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="font-headline text-xl flex items-center">
            <CalendarDays className="mr-2 h-5 w-5 text-primary opacity-70" />
            {day}
          </CardTitle>
          {dailyWeather && WeatherIcon && (
            <div className="flex items-center text-sm text-muted-foreground" title={`${dailyWeather.maxTemp}°F - ${dailyWeather.description}`}>
              <WeatherIcon className="mr-1 h-5 w-5" />
              <Thermometer className="mr-0.5 h-4 w-4 text-blue-500" />
              <span>{dailyWeather.maxTemp}°F</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-grow space-y-3">
        {createItemSelector('entree', 'Entree', Beef, 'Select an entree...', dayData.entree, entreeItems)}
        {createItemSelector('side1', 'Side 1', Salad, 'Select a side...', dayData.side1, sideItems)}
        {createItemSelector('side2', 'Side 2', Utensils, 'Select another side...', dayData.side2, sideItems)}
        
        <div className="space-y-1 day-card-note-area pt-2">
          <Label htmlFor={`note-${day}`} className="text-xs font-medium text-muted-foreground flex items-center">
            <StickyNote className="mr-1 h-3 w-3" />
            Note / Event:
          </Label>
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
