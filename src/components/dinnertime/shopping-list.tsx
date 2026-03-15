"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { WeeklyPlan, ManualGroceryItem } from '@/types';
import { ShoppingCart, PlusCircle, Trash2 } from 'lucide-react';
import { aggregatePlanItems } from '@/lib/plan-utils';

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

  // Shared utility keeps this list in sync with the export
  const plannedItems = aggregatePlanItems(plan);

  const hasPlannedItems = plannedItems.length > 0;
  const hasManualItems = manualItems.length > 0;

  return (
    <Card className="shadow-lg flex flex-col animate-fade-up">
      <CardHeader className="pb-3">
        <CardTitle className="font-headline text-xl md:text-2xl flex items-center">
          <ShoppingCart className="mr-2 h-5 w-5 md:h-6 md:w-6 text-primary" />
          Shopping List
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-grow space-y-4 px-4">
        {hasPlannedItems && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">From Your Plan:</h3>
            <ul className="space-y-1">
              {plannedItems.map(item => (
                <li key={item.displayText} className="text-foreground shopping-list-item py-0.5">
                  {item.displayText} {item.count > 1 ? `(x${item.count})` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasPlannedItems && hasManualItems && <Separator className="my-2" />}

        {hasManualItems && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Manual Additions:</h3>
            {/* ScrollArea kicks in when the list gets long on smaller viewports */}
            <ScrollArea className={manualItems.length > 5 ? "h-40 md:h-32" : ""}>
              <ul className="space-y-0.5">
                {manualItems.map(item => (
                  <li
                    key={item.id}
                    className="flex justify-between items-center text-foreground shopping-list-item manual-grocery-item py-1.5"
                  >
                    <span className="text-sm">{item.name}</span>
                    {/* h-10 w-10 = 40px — adequate touch target for a list-row delete */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteManualItem(item.id)}
                      className="text-destructive hover:text-destructive button-no-print h-10 w-10 p-0 flex-shrink-0"
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

        {!hasPlannedItems && !hasManualItems && (
          <p className="text-sm text-muted-foreground py-2">
            No items planned yet. Fill in the planner and your shopping list will appear here.
          </p>
        )}
      </CardContent>

      <CardFooter className="border-t pt-4 pb-4 px-4 non-printable-elements">
        <div className="w-full space-y-2">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Add custom item (e.g., Milk)"
              value={manualItemName}
              onChange={e => setManualItemName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddClick()}
              aria-label="Add manual grocery item"
              className="flex-grow h-11"
            />
            {/* h-11 = 44px touch target */}
            <Button onClick={handleAddClick} aria-label="Add item to shopping list" className="h-11 w-11 flex-shrink-0 p-0">
              <PlusCircle className="h-5 w-5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Planned items are above. Add extra groceries here.
          </p>
        </div>
      </CardFooter>
    </Card>
  );
};

export default ShoppingList;
