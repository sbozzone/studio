
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { WeeklyPlan, Item, DayPlanData, ManualGroceryItem } from '@/types';
import { ShoppingCart, PlusCircle, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ShoppingListProps {
  plan: WeeklyPlan;
  manualItems: ManualGroceryItem[];
  onAddManualItem: (name: string) => void;
  onDeleteManualItem: (id: string) => void;
}

const ShoppingList: FC<ShoppingListProps> = ({ plan, manualItems, onAddManualItem, onDeleteManualItem }) => {
  const [manualItemName, setManualItemName] = useState('');

  const handleAddClick = () => {
    if (manualItemName.trim()) {
      onAddManualItem(manualItemName.trim());
      setManualItemName('');
    }
  };

  const plannedItems: Item[] = [];
  Object.values(plan).forEach((dayData: DayPlanData) => {
    if (dayData.entree) plannedItems.push(dayData.entree);
    if (dayData.side1) plannedItems.push(dayData.side1);
    if (dayData.side2) plannedItems.push(dayData.side2);
  });
  
  const itemCounts: Record<string, { count: number; type: string }> = {};
  plannedItems.forEach(item => {
    if (!item) return; // Should not happen if logic above is correct
    const key = `${item.name} (${item.type})`;
    if (itemCounts[key]) {
      itemCounts[key].count++;
    } else {
      itemCounts[key] = { count: 1, type: item.type };
    }
  });

  const uniquePlannedItemsWithCounts = Object.entries(itemCounts)
    .map(([nameAndType, data]) => ({
      displayText: nameAndType,
      count: data.count,
    }))
    .sort((a, b) => a.displayText.localeCompare(b.displayText));

  const hasPlannedItems = uniquePlannedItemsWithCounts.length > 0;
  const hasManualItems = manualItems.length > 0;

  return (
    <Card className="shadow-lg flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <ShoppingCart className="mr-2 h-6 w-6 text-primary" />
          Shopping List
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        {hasPlannedItems && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">From Your Plan:</h3>
            <ul className="space-y-1">
              {uniquePlannedItemsWithCounts.map(item => (
                <li key={item.displayText} className="text-foreground shopping-list-item">
                  {item.displayText} {item.count > 1 ? `(x${item.count})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(hasPlannedItems && hasManualItems) && <Separator className="my-4" />}

        {hasManualItems && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Manual Additions:</h3>
             <ScrollArea className={manualItems.length > 5 ? "h-32" : ""}>
              <ul className="space-y-1">
                {manualItems.map(item => (
                  <li key={item.id} className="flex justify-between items-center text-foreground shopping-list-item manual-grocery-item py-1">
                    <span>{item.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteManualItem(item.id)}
                      className="text-destructive hover:text-destructive button-no-print h-auto p-1"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}

        {(!hasPlannedItems && !hasManualItems) && (
          <p className="text-muted-foreground">No items planned or added yet to generate a shopping list.</p>
        )}
      </CardContent>
      <CardFooter className="border-t pt-4 non-printable-elements">
        <div className="w-full space-y-2">
            <div className="flex gap-2">
            <Input
                type="text"
                placeholder="Add custom item (e.g., Milk)"
                value={manualItemName}
                onChange={(e) => setManualItemName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddClick()}
                aria-label="Add manual grocery item"
                className="flex-grow"
            />
            <Button onClick={handleAddClick} aria-label="Add item to shopping list">
                <PlusCircle className="h-5 w-5" />
            </Button>
            </div>
            <p className="text-xs text-muted-foreground">
            Planned items are listed above. Add other groceries you need here.
            </p>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ShoppingList;
