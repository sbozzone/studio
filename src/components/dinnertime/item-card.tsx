
"use client";

import type { FC } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Star, Lightbulb, Trash2, Drumstick, Carrot, Pencil, Save, XCircle } from 'lucide-react';
import type { Item } from '@/types';

interface ItemCardProps {
  item: Item;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string) => void;
  onSelectForVariation: (item: Item) => void;
  onDeleteItem?: (itemId: string) => void;
  onEditItemName: (itemId: string, newName: string) => void; // New prop
}

const ItemCard: FC<ItemCardProps> = ({ item, isFavorite, onToggleFavorite, onSelectForVariation, onDeleteItem, onEditItemName }) => {
  const Icon = item.type === 'entree' ? Drumstick : Carrot;
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(item.name);

  useEffect(() => {
    setEditedName(item.name); // Reset editedName if item.name changes from parent
    setIsEditing(false); // Also exit editing mode if item prop changes (e.g., deletion/re-render)
  }, [item.name, item.id]);


  const handleEdit = () => {
    setEditedName(item.name); // Ensure input starts with current name
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedName(item.name); // Revert to original name
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
      <CardHeader>
        <div className="flex justify-between items-start">
          {isEditing ? (
            <div className="flex items-center gap-2 w-full pr-2">
              <Icon className="h-5 w-5 text-primary shrink-0" />
              <Input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="text-xl font-headline h-9 flex-grow"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSave) handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
            </div>
          ) : (
            <CardTitle className="flex items-center font-headline text-xl">
              <Icon className="mr-2 h-5 w-5 text-primary" />
              {item.name}
            </CardTitle>
          )}
          <Badge variant={item.type === 'entree' ? 'default' : 'secondary'} className="capitalize text-xs shrink-0">
            {item.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Placeholder for potential future content */}
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        {isEditing ? (
          <>
            <Button onClick={handleSaveEdit} disabled={!canSave} className="flex-grow">
              <Save className="mr-2 h-5 w-5" />
              Save
            </Button>
            <Button variant="outline" onClick={handleCancelEdit} className="flex-grow">
              <XCircle className="mr-2 h-5 w-5" />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => onToggleFavorite(item.id)} className="flex-grow">
              <Star className={`mr-2 h-5 w-5 ${isFavorite ? 'fill-yellow-400 text-yellow-500' : 'text-muted-foreground'}`} />
              {isFavorite ? 'Unfavorite' : 'Favorite'}
            </Button>
            <Button variant="outline" onClick={() => onSelectForVariation(item)} className="flex-grow">
              <Lightbulb className="mr-2 h-5 w-5 text-accent" />
              Variations
            </Button>
            <Button variant="ghost" size="icon" onClick={handleEdit} aria-label="Edit item name">
              <Pencil className="h-5 w-5 text-muted-foreground hover:text-accent" />
            </Button>
            {onDeleteItem && (
              <Button variant="ghost" size="icon" onClick={() => onDeleteItem(item.id)} aria-label="Delete item">
                <Trash2 className="h-5 w-5 text-destructive" />
              </Button>
            )}
          </>
        )}
      </CardFooter>
    </Card>
  );
};

export default ItemCard;
