
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
  onDeleteItem?: (itemId: string) => void;
  onEditItemName: (itemId: string, newName: string) => void;
}

const ItemCard: FC<ItemCardProps> = ({ item, onDeleteItem, onEditItemName }) => {
  const Icon = item.type === 'entree' ? Drumstick : Carrot;
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);

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
        <div className="flex justify-between items-start">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full pr-2">
              <Icon className="h-4 w-4 text-primary shrink-0" />
              <Input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-lg font-headline h-8 flex-grow"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            </div>
          ) : (
            <CardTitle className="flex items-center font-headline text-lg">
              <Icon className="mr-2 h-4 w-4 text-primary" />
              {item.name}
            </CardTitle>
          )}
          <Badge variant={item.type === 'entree' ? 'default' : 'secondary'} className="capitalize text-xs shrink-0">
            {item.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Content padding removed as it's not used currently. Can be added back if needed. */}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center py-3 px-4">
        {isEditing ? (
          <>
            <Button onClick={handleSaveEdit} disabled={!canSave} className="flex-grow h-8">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button variant="outline" onClick={handleCancelEdit} className="flex-grow h-8">
              <XCircle className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" onClick={handleEdit} aria-label="Edit item name" className="ml-auto h-8 w-8">
              <Pencil className="h-4 w-4 text-muted-foreground hover:text-accent" />
            </Button>
            {onDeleteItem && (
              <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item.id)} aria-label="Delete item" className="h-8 w-8">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default ItemCard;

