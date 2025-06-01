
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { PlusCircle, Utensils } from 'lucide-react';
import type { Item, ItemType } from '@/types';

interface ItemInputFormProps {
  onAddItem: (item: Item) => void;
}

const ItemInputForm: FC<ItemInputFormProps> = ({ onAddItem }) => {
  const [itemName, setItemName] = useState('');
  const [itemType, setItemType] = useState<ItemType>('entree');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (itemName.trim()) {
      const newItem: Item = {
        id: crypto.randomUUID(), // Ensure this runs client-side
        name: itemName.trim(),
        type: itemType,
      };
      onAddItem(newItem);
      setItemName('');
      setItemType('entree'); // Reset to default
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-2xl">
          <Utensils className="mr-2 h-6 w-6 text-primary" />
          Add New Item
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="text"
            placeholder="E.g., Chicken Curry or Garden Salad"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            aria-label="New item name"
          />
          <RadioGroup
            value={itemType}
            onValueChange={(value: string) => setItemType(value as ItemType)}
            className="flex space-x-4"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="entree" id="type-entree" />
              <Label htmlFor="type-entree" className="font-normal">Entree</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="side" id="type-side" />
              <Label htmlFor="type-side" className="font-normal">Side Dish</Label>
            </div>
          </RadioGroup>
          <Button type="submit" className="w-full">
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Item
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ItemInputForm;
