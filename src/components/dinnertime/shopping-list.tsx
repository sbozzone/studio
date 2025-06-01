
"use client";

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { WeeklyPlan } from '@/types';
import { ShoppingCart } from 'lucide-react';

interface ShoppingListProps {
  plan: WeeklyPlan;
}

const ShoppingList: FC<ShoppingListProps> = ({ plan }) => {
  const mealsInPlan = Object.values(plan).filter(meal => meal !== null) as string[];
  const uniqueMeals = Array.from(new Set(mealsInPlan)).sort();

  if (uniqueMeals.length === 0) {
    // Optionally, you could render a message here, but for print, null is fine.
    // For UI consistency, it might be better to show a card with "No meals planned for shopping."
    return (
       <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
            <ShoppingCart className="mr-2 h-6 w-6 text-primary" />
            Shopping List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No meals planned yet to generate a shopping list.</p>
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
          {uniqueMeals.map(meal => (
            <li key={meal} className="text-foreground shopping-list-item">{meal}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
};

export default ShoppingList;
