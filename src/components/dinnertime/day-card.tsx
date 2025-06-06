
"use client";

import * as React from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, CalendarDays, StickyNote, Salad, Beef, Utensils, Dices, UtensilsCrossed } from 'lucide-react';
import type { DayOfWeek, Item, DayPlanData } from '@/types';
import { Label } from '@/components/ui/label';

interface DayCardProps {
  day: DayOfWeek;
  dayData: DayPlanData;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void;
}

const DayCard: FC<DayCardProps> = ({ day, dayData, allItems, onUpdateDayData }) => {
  const entreeItems = allItems.filter(item => item.type === 'entree');
  const sideItems = allItems.filter(item => item.type === 'side');

  const handleItemSelectChange = (itemSlot: 'entree' | 'side1' | 'side2', itemId: string) => {
    if (itemSlot === 'entree' && itemId === "eat-out") {
      onUpdateDayData(day, { 
        entree: null, 
        side1: null, 
        side2: null, 
        note: "Screw It, let's eat out!" 
      });
    } else if (itemId === "none" || itemId === "") {
      // If clearing an entree and the note was "Screw It, let's eat out!", clear the note too.
      if (itemSlot === 'entree' && dayData.note === "Screw It, let's eat out!") {
        onUpdateDayData(day, { [itemSlot]: null, note: '' });
      } else {
        onUpdateDayData(day, { [itemSlot]: null });
      }
    } else if (itemId === "feeling-lucky") {
      const relevantItems = itemSlot === 'entree' ? entreeItems : sideItems;
      if (relevantItems.length > 0) {
        const randomIndex = Math.floor(Math.random() * relevantItems.length);
        const luckyItem = relevantItems[randomIndex];
        // If "feeling lucky" picks an entree and the current note is "Screw It, let's eat out!", clear the note.
        if (itemSlot === 'entree' && dayData.note === "Screw It, let's eat out!") {
          onUpdateDayData(day, { [itemSlot]: luckyItem, note: '' });
        } else {
          onUpdateDayData(day, { [itemSlot]: luckyItem });
        }
      } else {
        // No items to pick from, treat as "none"
        if (itemSlot === 'entree' && dayData.note === "Screw It, let's eat out!") {
          onUpdateDayData(day, { [itemSlot]: null, note: '' });
        } else {
          onUpdateDayData(day, { [itemSlot]: null });
        }
      }
    } else {
      const selectedItem = allItems.find(item => item.id === itemId);
      // If selecting a specific entree, and the current note is "Screw It, let's eat out!", clear the note.
      if (itemSlot === 'entree' && dayData.note === "Screw It, let's eat out!") {
        onUpdateDayData(day, { [itemSlot]: selectedItem || null, note: '' });
      } else {
        onUpdateDayData(day, { [itemSlot]: selectedItem || null });
      }
    }
  };

  const handleNoteChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateDayData(day, { note: event.target.value });
  };

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
            {slot === 'entree' && (
              <SelectItem value="eat-out">
                <div className="flex items-center">
                  <UtensilsCrossed className="mr-2 h-4 w-4 opacity-70" />
                  Screw It, let's eat out!
                </div>
              </SelectItem>
            )}
            <SelectItem value="feeling-lucky">
              <div className="flex items-center">
                <Dices className="mr-2 h-4 w-4 opacity-70" />
                I'm Feeling Lucky
              </div>
            </SelectItem>
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
            onClick={() => handleItemSelectChange(slot, "none")} // Use "none" to trigger potential note clearing
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
