"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Lightbulb, Trash2, Drumstick } from 'lucide-react';

interface MealCardProps {
  mealName: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelectForVariation: () => void;
  onDeleteMeal?: () => void; // Optional: if meals can be deleted from the main list
}

const MealCard: FC<MealCardProps> = ({ mealName, isFavorite, onToggleFavorite, onSelectForVariation, onDeleteMeal }) => {
  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-xl">
          <Drumstick className="mr-2 h-5 w-5 text-primary" />
          {mealName}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Placeholder for potential future content like ingredients or image */}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <Button variant="outline" onClick={onToggleFavorite} className="flex-grow">
          <Star className={`mr-2 h-5 w-5 ${isFavorite ? 'fill-yellow-400 text-yellow-500' : 'text-muted-foreground'}`} />
          {isFavorite ? 'Unfavorite' : 'Favorite'}
        </Button>
        <Button variant="outline" onClick={onSelectForVariation} className="flex-grow">
          <Lightbulb className="mr-2 h-5 w-5 text-accent" />
          Variations
        </Button>
        {onDeleteMeal && (
           <Button variant="ghost" size="icon" onClick={onDeleteMeal} aria-label="Delete meal">
             <Trash2 className="h-5 w-5 text-destructive" />
           </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default MealCard;
