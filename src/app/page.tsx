
"use client";

import { useState, useEffect } from 'react';
import ItemInputForm from '@/components/dinnertime/item-input-form';
import ItemListDisplay from '@/components/dinnertime/item-list-display';
import WeeklyPlannerGrid from '@/components/dinnertime/weekly-planner-grid';
import SmartSuggestionCTA from '@/components/dinnertime/smart-suggestion-cta';
import VariationGeneratorDialog from '@/components/dinnertime/variation-generator-dialog';
import ExportButton from '@/components/dinnertime/export-button';
import PrintButton from '@/components/dinnertime/print-button';
import ShoppingList from '@/components/dinnertime/shopping-list';
import { useToast } from '@/hooks/use-toast';
import type { DayOfWeek, WeeklyPlan, Item, ItemType } from '@/types';
import { DAYS_OF_WEEK } from '@/types';
import { ChefHat } from 'lucide-react';
import { suggestMeals as suggestItemsAI } from '@/ai/flows/smart-suggestion'; // Renamed flow
import { generateMealVariations as generateItemVariationsAI } from '@/ai/flows/variation-generation'; // Renamed flow

export default function DinnerTimePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<string[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(
    DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: null }), {} as WeeklyPlan)
  );

  const [suggestedAIItemNames, setSuggestedAIItemNames] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const [selectedItemForVariation, setSelectedItemForVariation] = useState<Item | null>(null);
  const [isVariationDialogOpen, setIsVariationDialogOpen] = useState(false);
  const [itemVariations, setItemVariations] = useState<string[]>([]);
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);
  
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedItems = localStorage.getItem('dinnertime_items');
    if (storedItems) setItems(JSON.parse(storedItems));
    const storedFavorites = localStorage.getItem('dinnertime_favoriteItemIds');
    if (storedFavorites) setFavoriteItemIds(JSON.parse(storedFavorites));
    const storedPlan = localStorage.getItem('dinnertime_weeklyPlan');
    if (storedPlan) setWeeklyPlan(JSON.parse(storedPlan));
  }, []);

  useEffect(() => {
    if(isClient) localStorage.setItem('dinnertime_items', JSON.stringify(items));
  }, [items, isClient]);

  useEffect(() => {
    if(isClient) localStorage.setItem('dinnertime_favoriteItemIds', JSON.stringify(favoriteItemIds));
  }, [favoriteItemIds, isClient]);

  useEffect(() => {
    if(isClient) localStorage.setItem('dinnertime_weeklyPlan', JSON.stringify(weeklyPlan));
  }, [weeklyPlan, isClient]);

  const { toast } = useToast();

  const handleAddItem = (newItem: Item) => {
    if (!items.some(item => item.name === newItem.name && item.type === newItem.type)) {
      setItems((prev) => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      toast({ title: "Item Added!", description: `"${newItem.name} (${newItem.type})" has been added.` });
    } else {
      toast({ title: "Already Exists", description: `"${newItem.name} (${newItem.type})" is already in your list.`, variant: "destructive" });
    }
  };

  const handleDeleteItem = (itemIdToDelete: string) => {
    const itemToDelete = items.find(i => i.id === itemIdToDelete);
    if (!itemToDelete) return;

    setItems(prev => prev.filter(i => i.id !== itemIdToDelete));
    setFavoriteItemIds(prev => prev.filter(id => id !== itemIdToDelete));
    
    const updatedPlan = { ...weeklyPlan };
    let planChanged = false;
    for (const day of DAYS_OF_WEEK) {
      if (updatedPlan[day]?.id === itemIdToDelete) {
        updatedPlan[day] = null;
        planChanged = true;
      }
    }
    if (planChanged) setWeeklyPlan(updatedPlan);
    toast({ title: "Item Deleted", description: `"${itemToDelete.name}" has been removed.`});
  };

  const handleToggleFavoriteItem = (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const isCurrentlyFavorite = favoriteItemIds.includes(itemId);
    setFavoriteItemIds((prev) =>
      isCurrentlyFavorite
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
    toast({
      title: isCurrentlyFavorite ? "Unfavorited" : "Favorited!",
      description: `"${item.name}" has been ${isCurrentlyFavorite ? 'removed from' : 'added to'} favorites.`,
    });
  };

  const handleUpdatePlan = (day: DayOfWeek, item: Item | null) => {
    setWeeklyPlan((prev) => ({ ...prev, [day]: item }));
  };

  const handleGetSuggestions = async () => {
    if (items.length === 0) {
      toast({ title: "No Items", description: "Add some items first to get suggestions.", variant: "destructive" });
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      // Pass only item names to the AI for now
      const result = await suggestItemsAI({ mealList: items.map(item => item.name) });
      setSuggestedAIItemNames(result.suggestedMeals); // AI output schema still uses suggestedMeals
      if (result.suggestedMeals.length > 0) {
        toast({ title: "Suggestions Ready!", description: "Check out these item ideas." });
      } else {
        toast({ title: "No Suggestions Found", description: "Couldn't find any suggestions right now." });
      }
    } catch (error) {
      console.error("Error getting suggestions:", error);
      toast({ title: "Error", description: "Could not fetch item suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };
  
  const handleAddSuggestedItem = (itemName: string, itemType: ItemType = 'entree') => {
    const newItem: Item = {
      id: crypto.randomUUID(),
      name: itemName,
      type: itemType, // Defaulting to entree, or could be passed from CTA if UI is added there
    };
    handleAddItem(newItem);
  };


  const handleSelectForVariation = (item: Item) => {
    setSelectedItemForVariation(item);
    setItemVariations([]);
    setIsVariationDialogOpen(true);
  };

  const handleGenerateVariations = async () => {
    if (!selectedItemForVariation) return;
    setIsLoadingVariations(true);
    try {
      const favoriteItemsForAI = items.filter(i => favoriteItemIds.includes(i.id));
      const result = await generateItemVariationsAI({
        selectedMeal: selectedItemForVariation.name, // AI input schema still uses selectedMeal
        favoriteMeals: favoriteItemsForAI.map(i => i.name), // AI input schema still uses favoriteMeals
      });
      setItemVariations(result.variations);
      if (result.variations.length > 0) {
        toast({ title: "Variations Generated!", description: `New ideas for "${selectedItemForVariation.name}" are ready.` });
      } else {
        toast({ title: "No Variations Found", description: `Couldn't find variations for "${selectedItemForVariation.name}".` });
      }
    } catch (error) {
      console.error("Error generating variations:", error);
      toast({ title: "Error", description: "Could not generate item variations.", variant: "destructive" });
    } finally {
      setIsLoadingVariations(false);
    }
  };
  
  if (!isClient) {
    return (
      <div className="flex justify-center items-center min-h-screen non-printable-elements">
        <ChefHat className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl font-headline">Loading DinnerTime...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="text-center py-8 non-printable-elements">
        <h1 className="text-5xl md:text-6xl font-headline text-primary flex items-center justify-center">
          <ChefHat className="mr-4 h-12 w-12 md:h-16 md:w-16" />
          DinnerTime
        </h1>
        <p className="text-lg text-muted-foreground mt-2">Plan your weekly entrees and sides with appetite and comfort.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <ItemInputForm onAddItem={handleAddItem} />
          <ItemListDisplay
            items={items}
            favoriteItemIds={favoriteItemIds}
            onToggleFavorite={handleToggleFavoriteItem}
            onSelectForVariation={handleSelectForVariation}
            onDeleteItem={handleDeleteItem}
          />
          <SmartSuggestionCTA
            onGetSuggestions={handleGetSuggestions}
            suggestions={suggestedAIItemNames}
            isLoading={isLoadingSuggestions}
            onAddSuggestedItem={handleAddSuggestedItem}
          />
        </aside>

        <main id="printable-area" className="lg:col-span-2 space-y-6">
          <WeeklyPlannerGrid
            plan={weeklyPlan}
            allItems={items}
            onUpdatePlan={handleUpdatePlan}
          />
          <ShoppingList plan={weeklyPlan} />
          <div className="flex flex-col sm:flex-row justify-end gap-2 non-printable-elements">
            <PrintButton />
            <ExportButton plan={weeklyPlan} items={items} />
          </div>
        </main>
      </div>

      <VariationGeneratorDialog
        isOpen={isVariationDialogOpen}
        onOpenChange={setIsVariationDialogOpen}
        selectedItem={selectedItemForVariation}
        favoriteItems={items.filter(i => favoriteItemIds.includes(i.id))}
        onGenerateVariations={handleGenerateVariations}
        variations={itemVariations}
        isLoading={isLoadingVariations}
        className="non-printable-elements"
      />
    </div>
  );
}
