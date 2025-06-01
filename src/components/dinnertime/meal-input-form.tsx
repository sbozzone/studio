"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Utensils } from 'lucide-react';

interface MealInputFormProps {
  onAddMeal: (mealName: string) => void;
}

const MealInputForm: FC<MealInputFormProps> = ({ onAddMeal }) => {
  const [mealName, setMealName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mealName.trim()) {
      onAddMeal(mealName.trim());
      setMealName('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-2xl">
          <Utensils className="mr-2 h-6 w-6 text-primary" />
          Add a New Meal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="E.g., Spaghetti Bolognese"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
            aria-label="New meal name"
          />
          <Button type="submit" className="w-full">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Meal
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default MealInputForm;
