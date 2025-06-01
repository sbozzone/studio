
"use client";

import type { FC } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChefHat, Lightbulb, Wand2 } from 'lucide-react';
import type { Item } from '@/types'; // Added Item

interface VariationGeneratorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedItem: Item | null; // Changed from selectedMeal
  favoriteItems: Item[]; // Changed from favoriteMeals (now expecting Item objects)
  onGenerateVariations: () => void;
  variations: string[];
  isLoading: boolean;
  className?: string; // Added className prop
}

const VariationGeneratorDialog: FC<VariationGeneratorDialogProps> = ({
  isOpen,
  onOpenChange,
  selectedItem,
  favoriteItems,
  onGenerateVariations,
  variations,
  isLoading,
  className, // Consumed className
}) => {
  if (!selectedItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-md", className)}> {/* Used cn and className */}
        <DialogHeader>
          <DialogTitle className="flex items-center font-headline text-2xl">
            <ChefHat className="mr-2 h-6 w-6 text-primary" />
            Item Variations for: {selectedItem.name}
          </DialogTitle>
          <DialogDescription>
            Generate variations for &quot;{selectedItem.name} ({selectedItem.type})&quot; using ingredients or styles from your favorite items.
          </DialogDescription>
        </DialogHeader>
        
        {favoriteItems.length > 0 && (
          <div className="my-4">
            <h4 className="font-semibold mb-2 font-headline text-sm">Using your favorite items as inspiration:</h4>
            <ScrollArea className="h-20 border rounded-md p-2">
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {favoriteItems.map(favItem => <li key={favItem.id}>{favItem.name} ({favItem.type})</li>)}
              </ul>
            </ScrollArea>
          </div>
        )}
        {favoriteItems.length === 0 && (
             <p className="text-sm text-muted-foreground my-4">Add some favorite items to get more personalized variations!</p>
        )}

        <Button onClick={onGenerateVariations} disabled={isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Wand2 className="mr-2 h-5 w-5" />
          {isLoading ? 'Generating...' : 'Generate Variations'}
        </Button>

        {variations.length > 0 && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2 font-headline">Suggested Variations:</h4>
            <ScrollArea className="h-32">
              <ul className="space-y-2 pr-2">
                {variations.map((variation, index) => (
                  <li key={index} className="p-2 border rounded-md bg-secondary/50 flex items-center">
                    <Lightbulb className="mr-2 h-4 w-4 text-accent shrink-0" />
                    <span>{variation}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
// Helper cn function if not already globally available in this file scope
// For ShadCN projects, it's usually in '@/lib/utils'
const cn = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');


export default VariationGeneratorDialog;
