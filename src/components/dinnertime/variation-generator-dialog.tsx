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

interface VariationGeneratorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedMeal: string | null;
  favoriteMeals: string[]; // Assuming global favorites are passed
  onGenerateVariations: () => void;
  variations: string[];
  isLoading: boolean;
}

const VariationGeneratorDialog: FC<VariationGeneratorDialogProps> = ({
  isOpen,
  onOpenChange,
  selectedMeal,
  favoriteMeals,
  onGenerateVariations,
  variations,
  isLoading,
}) => {
  if (!selectedMeal) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center font-headline text-2xl">
            <ChefHat className="mr-2 h-6 w-6 text-primary" />
            Meal Variations for: {selectedMeal}
          </DialogTitle>
          <DialogDescription>
            Generate variations for &quot;{selectedMeal}&quot; using ingredients or styles from your favorite meals.
          </DialogDescription>
        </DialogHeader>
        
        {favoriteMeals.length > 0 && (
          <div className="my-4">
            <h4 className="font-semibold mb-2 font-headline text-sm">Using your favorite meals as inspiration:</h4>
            <ScrollArea className="h-20 border rounded-md p-2">
              <ul className="text-sm text-muted-foreground list-disc list-inside">
                {favoriteMeals.map(favMeal => <li key={favMeal}>{favMeal}</li>)}
              </ul>
            </ScrollArea>
          </div>
        )}
        {favoriteMeals.length === 0 && (
             <p className="text-sm text-muted-foreground my-4">Add some favorite meals to get more personalized variations!</p>
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

export default VariationGeneratorDialog;
