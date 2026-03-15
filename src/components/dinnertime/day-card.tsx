"use client";

import * as React from 'react';
import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Trash2, CalendarDays, StickyNote, Salad, Beef, Utensils, Dices, UtensilsCrossed } from 'lucide-react';
import type { DayOfWeek, Item, DayPlanData } from '@/types';
import { EAT_OUT_NOTE } from '@/lib/plan-utils';
import { cn } from '@/lib/utils';

interface DayCardProps {
  day: DayOfWeek;
  dayData: DayPlanData;
  allItems: Item[];
  onUpdateDayData: (day: DayOfWeek, data: Partial<DayPlanData>) => void;
  isToday?: boolean;
}

/** Fire a lightweight confetti burst to celebrate a lucky meal pick. */
const fireConfetti = () => {
  import('canvas-confetti').then(({ default: confetti }) => {
    confetti({
      particleCount: 90,
      spread: 80,
      origin: { y: 0.55 },
      colors: ['#FF7F50', '#FFD700', '#FF6B6B', '#4ecdc4', '#45b7d1', '#a8edea'],
      disableForReducedMotion: true,
    });
  }).catch(() => {/* silently ignore if confetti fails to load */});
};

const DayCard: FC<DayCardProps> = ({ day, dayData, allItems, onUpdateDayData, isToday = false }) => {
  const entreeItems = allItems.filter(item => item.type === 'entree');
  const sideItems = allItems.filter(item => item.type === 'side');

  const handleItemSelectChange = (
    itemSlot: 'entree' | 'side1' | 'side2',
    itemId: string
  ) => {
    const shouldClearNote = itemSlot === 'entree' && dayData.note === EAT_OUT_NOTE;
    const buildUpdate = (slotValue: Item | null): Partial<DayPlanData> =>
      shouldClearNote ? { [itemSlot]: slotValue, note: '' } : { [itemSlot]: slotValue };

    if (itemSlot === 'entree' && itemId === 'eat-out') {
      onUpdateDayData(day, { entree: null, side1: null, side2: null, note: EAT_OUT_NOTE });
    } else if (itemId === 'none' || itemId === '') {
      onUpdateDayData(day, buildUpdate(null));
    } else if (itemId === 'feeling-lucky') {
      const pool = itemSlot === 'entree' ? entreeItems : sideItems;
      const luckyItem = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : null;
      onUpdateDayData(day, buildUpdate(luckyItem));
      // Celebrate a successful lucky pick with confetti!
      if (luckyItem) fireConfetti();
    } else {
      const selectedItem = allItems.find(item => item.id === itemId) ?? null;
      onUpdateDayData(day, buildUpdate(selectedItem));
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
      <Label
        htmlFor={`${day}-${slot}`}
        className="text-xs font-medium text-muted-foreground flex items-center"
      >
        {React.createElement(icon, { className: "mr-1.5 h-4 w-4 opacity-80" })}
        {label}:
      </Label>
      <div className="flex items-center gap-1">
        <Select
          value={currentValue?.id || ""}
          onValueChange={itemId => handleItemSelectChange(slot, itemId)}
          name={`${day}-${slot}-select`}
          aria-label={`Select ${label.toLowerCase()} for ${day}`}
        >
          <SelectTrigger id={`${day}-${slot}`} className="day-card-select-trigger w-full h-11">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Not Planned --</SelectItem>
            {slot === 'entree' && (
              <SelectItem value="eat-out">
                <div className="flex items-center">
                  <UtensilsCrossed className="mr-2 h-4 w-4 opacity-70" />
                  Screw It, let&apos;s eat out!
                </div>
              </SelectItem>
            )}
            <SelectItem value="feeling-lucky">
              <div className="flex items-center">
                <Dices className="mr-2 h-4 w-4 opacity-70" />
                I&apos;m Feeling Lucky
              </div>
            </SelectItem>
            {availableItems.map(item => (
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
            onClick={() => handleItemSelectChange(slot, 'none')}
            className="text-destructive hover:text-destructive button-no-print h-11 w-11 flex-shrink-0"
            aria-label={`Clear ${label.toLowerCase()} for ${day}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        "flex flex-col transition-all duration-200",
        // Subtle hover lift on desktop
        "hover:shadow-md hover:-translate-y-0.5",
        // Today: coral ring + slightly elevated shadow
        isToday
          ? "ring-2 ring-primary/70 shadow-md shadow-primary/10 border-primary/30"
          : ""
      )}
    >
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="font-headline text-base md:text-lg flex items-center justify-between gap-2">
          <span className="flex items-center min-w-0">
            <CalendarDays
              className={cn(
                "mr-2 h-4 w-4 md:h-5 md:w-5 flex-shrink-0 opacity-70",
                isToday ? "text-primary" : "text-primary"
              )}
            />
            <span className={cn(isToday ? "text-primary" : "")}>{day}</span>
          </span>
          {isToday && (
            <Badge
              variant="default"
              className="text-[10px] px-2 py-0.5 font-semibold tracking-wide flex-shrink-0 bg-primary text-primary-foreground"
            >
              Today
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-3 px-4 pb-4">
        {createItemSelector('entree', 'Entree', Beef,     'Select an entree…',    dayData.entree, entreeItems)}
        {createItemSelector('side1',  'Side 1', Salad,    'Select a side…',       dayData.side1,  sideItems)}
        {createItemSelector('side2',  'Side 2', Utensils, 'Select another side…', dayData.side2,  sideItems)}

        <div className="space-y-1 day-card-note-area pt-1">
          <Label
            htmlFor={`note-${day}`}
            className="text-xs font-medium text-muted-foreground flex items-center"
          >
            <StickyNote className="mr-1 h-3 w-3" />
            Note / Event:
          </Label>
          <Textarea
            id={`note-${day}`}
            placeholder="E.g., BBQ at park, Guests over…"
            value={dayData.note}
            onChange={handleNoteChange}
            rows={2}
            className="text-sm resize-none transition-shadow focus:shadow-sm"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default DayCard;
