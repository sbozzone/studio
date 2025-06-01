"use client";

import type { FC } from 'react';
import MealCard from './meal-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListCollapse } from 'lucide-react';

interface MealListDisplayProps {
  meals: string[];
  favoriteMeals: string[];
  onToggleFavorite: (mealName: string) => void;
  onSelectForVariation: (mealName: string) => void;
  onDeleteMeal: (mealName: string) => void;
}

const MealListDisplay: FC<MealListDisplayProps> = ({ meals, favoriteMeals, onToggleFavorite, onSelectForVariation, onDeleteMeal }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-2xl">
          <ListCollapse className="mr-2 h-6 w-6 text-primary" />
          Your Meals
        </CardTitle>
      </CardHeader>
      <CardContent>
        {meals.length === 0 ? (
          <p className="text-muted-foreground">No meals added yet. Add some meals to get started!</p>
        ) : (
          <ScrollArea className="h-72">
            <div className="space-y-4 pr-4">
              {meals.map((meal) => (
                <MealCard
                  key={meal}
                  mealName={meal}
                  isFavorite={favoriteMeals.includes(meal)}
                  onToggleFavorite={() => onToggleFavorite(meal)}
                  onSelectForVariation={() => onSelectForVariation(meal)}
                  onDeleteMeal={() => onDeleteMeal(meal)}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default MealListDisplay;
