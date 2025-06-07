
"use client";

import type { FC } from 'react';
import ItemCard from './item-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListCollapse } from 'lucide-react';
import type { Item } from '@/types';

interface ItemListDisplayProps {
  items: Item[];
  onDeleteItem: (itemId: string) => void;
  onEditItemName: (itemId: string, newName: string) => void;
}

const ItemListDisplay: FC<ItemListDisplayProps> = ({ items, onDeleteItem, onEditItemName }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-xl md:text-2xl">
          <ListCollapse className="mr-2 h-6 w-6 text-primary" />
          Your Items
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-muted-foreground">No items added yet. Add some entrees or side dishes to get started!</p>
        ) : (
          <ScrollArea className="h-72">
            <div className="space-y-2 pr-4">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onDeleteItem={onDeleteItem}
                  onEditItemName={onEditItemName}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ItemListDisplay;
