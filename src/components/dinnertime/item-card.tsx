"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Trash2, Drumstick, Carrot, Pencil, Save, XCircle } from 'lucide-react';
import type { Item } from '@/types';

interface ItemCardProps {
  item: Item;
  onDeleteItem: (itemId: string) => void;
  onEditItemName: (itemId: string, newName: string) => void;
}

const ItemCard: FC<ItemCardProps> = ({ item, onDeleteItem, onEditItemName }) => {
  const Icon = item.type === 'entree' ? Drumstick : Carrot;
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);

  // Reset edit state if the underlying item changes (e.g. after a save)
  useEffect(() => {
    setEditedName(item.name);
    setIsEditing(false);
  }, [item.name, item.id]);

  const handleEdit = () => {
    setEditedName(item.name);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedName(item.name);
    setIsEditing(false);
  };

  const handleSaveEdit = () => {
    if (editedName.trim()) {
      onEditItemName(item.id, editedName.trim());
    }
    setIsEditing(false);
  };

  const canSave = editedName.trim() !== '';

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader className="py-3 px-4">
        <div className="flex justify-between items-start gap-2">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <Input
                type="text"
                value={editedName}
                onChange={e => setEditedName(e.target.value)}
                className="text-base font-headline h-9 flex-grow"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && canSave) handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            </div>
          ) : (
            <CardTitle className="flex items-center font-headline text-base">
              <Icon className="mr-2 h-4 w-4 text-primary shrink-0" />
              {item.name}
            </CardTitle>
          )}
          <Badge
            variant={item.type === 'entree' ? 'default' : 'secondary'}
            className="capitalize text-xs shrink-0 self-start mt-0.5"
          >
            {item.type}
          </Badge>
        </div>
      </CardHeader>

      {/* CardContent kept for structural consistency; unused visually */}
      <CardContent className="p-0" />

      <CardFooter className="flex flex-row gap-2 items-center py-2 px-4">
        {isEditing ? (
          <>
            <Button
              onClick={handleSaveEdit}
              disabled={!canSave}
              className="flex-grow h-11 text-sm"
            >
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              className="flex-grow h-11 text-sm"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            {/* h-11 w-11 = 44px — minimum WCAG touch target size */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEdit}
              aria-label="Edit item name"
              className="ml-auto h-11 w-11"
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteItem(item.id)}
              aria-label="Delete item"
              className="h-11 w-11"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default ItemCard;
