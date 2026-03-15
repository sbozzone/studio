
"use client";

import type { FC } from 'react';
import ItemCard from './item-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ListCollapse, UtensilsCrossed } from 'lucide-react';
import type { Item } from '@/types';

interface ItemListDisplayProps {
  items: Item[];
  onDeleteItem: (itemId: string) => void;
  onEditItemName: (itemId: string, newName: string) => void;
}

const ItemListDisplay: FC<ItemListDisplayProps> = ({ items, onDeleteItem, onEditItemName }) => {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-xl md:text-2xl">
          <ListCollapse className="mr-2 h-6 w-6 text-primary" />
          Your Items
          {items.length > 0 && (
            <span className="ml-auto text-sm font-normal text-muted-foreground tabular-nums">
              {items.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          /* ── Illustrated empty state ──────────────────────────────────── */
          <div className="flex flex-col items-center gap-3 py-10 text-center animate-fade-up">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <UtensilsCrossed className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-medium text-sm text-foreground">No items yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto leading-relaxed">
                Add your first entree or side dish using the form above
              </p>
            </div>
          </div>
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
