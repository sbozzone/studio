
"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Lightbulb, Trash2, Drumstick, Carrot } from 'lucide-react';
import type { Item } from '@/types';

interface ItemCardProps {
  item: Item;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string) => void;
  onSelectForVariation: (item: Item) => void;
  onDeleteItem?: (itemId: string) => void;
}

const ItemCard: FC<ItemCardProps> = ({ item, isFavorite, onToggleFavorite, onSelectForVariation, onDeleteItem }) => {
  const Icon = item.type === 'entree' ? Drumstick : Carrot;

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="flex items-center font-headline text-xl">
            <Icon className="mr-2 h-5 w-5 text-primary" />
            {item.name}
          </CardTitle>
          <Badge variant={item.type === 'entree' ? 'default' : 'secondary'} className="capitalize text-xs">
            {item.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Placeholder for potential future content */}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <Button variant="outline" onClick={() => onToggleFavorite(item.id)} className="flex-grow">
          <Star className={`mr-2 h-5 w-5 ${isFavorite ? 'fill-yellow-400 text-yellow-500' : 'text-muted-foreground'}`} />
          {isFavorite ? 'Unfavorite' : 'Favorite'}
        </Button>
        <Button variant="outline" onClick={() => onSelectForVariation(item)} className="flex-grow">
          <Lightbulb className="mr-2 h-5 w-5 text-accent" />
          Variations
        </Button>
        {onDeleteItem && (
           <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item.id)} aria-label="Delete item">
             <Trash2 className="h-5 w-5 text-destructive" />
           </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default ItemCard;
