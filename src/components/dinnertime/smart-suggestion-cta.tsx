
"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Wand2 } from 'lucide-react';
import type { ItemType } from '@/types'; // Added ItemType

interface SmartSuggestionCTAProps {
  onGetSuggestions: () => void;
  suggestions: string[]; // These are item names
  isLoading: boolean;
  onAddSuggestedItem: (itemName: string, itemType?: ItemType) => void; // Can optionally pass type
}

const SmartSuggestionCTA: FC<SmartSuggestionCTAProps> = ({ onGetSuggestions, suggestions, isLoading, onAddSuggestedItem }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-2xl">
          <Sparkles className="mr-2 h-6 w-6 text-primary" />
          Smart Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={onGetSuggestions} disabled={isLoading} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
          <Wand2 className="mr-2 h-5 w-5" />
          {isLoading ? 'Generating...' : 'Get Item Ideas'}
        </Button>
        {suggestions.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 font-headline">Try these:</h4>
            <ScrollArea className="h-40">
              <ul className="space-y-2 pr-2">
                {suggestions.map((suggestionName, index) => (
                  <li key={index} className="p-2 border rounded-md bg-secondary/50 flex justify-between items-center">
                    <span>{suggestionName}</span>
                    {/* Defaulting to 'entree' when adding from suggestion. More complex UI could allow type selection here. */}
                    <Button size="sm" variant="outline" onClick={() => onAddSuggestedItem(suggestionName, 'entree')}>Add to My Items</Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SmartSuggestionCTA;
