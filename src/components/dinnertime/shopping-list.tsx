
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklyPlan, Item, DayPlanData } from '@/types';
import { ShoppingCart } from 'lucide-react';

interface ShoppingListProps {
  plan: WeeklyPlan;
}

const ShoppingList: FC<ShoppingListProps> = ({ plan }) => {
  const itemsInPlan = Object.values(plan)
    .map((dayData: DayPlanData) => dayData.item)
    .filter(item => item !== null) as Item[];
  
  const itemCounts: Record<string, { count: number; type: string }> = {};
  itemsInPlan.forEach(item => {
    const key = `${item.name} (${item.type})`;
    if (itemCounts[key]) {
      itemCounts[key].count++;
    } else {
      itemCounts[key] = { count: 1, type: item.type };
    }
  });

  const uniqueItemsWithCounts = Object.entries(itemCounts)
    .map(([nameAndType, data]) => ({
      displayText: nameAndType,
      count: data.count,
    }))
    .sort((a, b) => a.displayText.localeCompare(b.displayText));

  if (uniqueItemsWithCounts.length === 0) {
    return (
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
            <ShoppingCart className="mr-2 h-6 w-6 text-primary" />
            Shopping List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No items planned yet to generate a shopping list.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl flex items-center">
          <ShoppingCart className="mr-2 h-6 w-6 text-primary" />
          Shopping List
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1">
          {uniqueItemsWithCounts.map(item => (
            <li key={item.displayText} className="text-foreground shopping-list-item">
              {item.displayText} {item.count > 1 ? `(x${item.count})` : ''}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground mt-2">
          Note: This list shows items based on your weekly plan. Actual ingredients may vary.
        </p>
      </CardContent>
    </Card>
  );
};

export default ShoppingList;
