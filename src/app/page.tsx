
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ItemInputForm from '@/components/dinnertime/item-input-form';
import ItemListDisplay from '@/components/dinnertime/item-list-display';
import WeeklyPlannerGrid from '@/components/dinnertime/weekly-planner-grid';
import SmartSuggestionCTA from '@/components/dinnertime/smart-suggestion-cta';
import VariationGeneratorDialog from '@/components/dinnertime/variation-generator-dialog';
import ExportButton from '@/components/dinnertime/export-button';
import PrintButton from '@/components/dinnertime/print-button';
import ShoppingList from '@/components/dinnertime/shopping-list';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { DayOfWeek, WeeklyPlan, Item, ItemType, DayPlanData, DailyWeather, ManualGroceryItem } from '@/types';
import { DAYS_OF_WEEK } from '@/types';
import { ChefHat, Settings } from 'lucide-react';
import { suggestMeals as suggestItemsAI } from '@/ai/flows/smart-suggestion';
import { generateMealVariations as generateItemVariationsAI } from '@/ai/flows/variation-generation';
import { fetchWeatherForecast } from '@/lib/weather-utils';

const getRotatedDays = (): DayOfWeek[] => {
  const todayIndex = new Date().getDay();
  const startIndexInDaysOfWeek = (todayIndex === 0) ? 6 : todayIndex - 1;
  return [
    ...DAYS_OF_WEEK.slice(startIndexInDaysOfWeek),
    ...DAYS_OF_WEEK.slice(0, startIndexInDaysOfWeek)
  ];
};

const initialWeeklyPlan = DAYS_OF_WEEK.reduce((acc, day) => {
  acc[day] = { item: null, note: '' };
  return acc;
}, {} as WeeklyPlan);

export default function DinnerTimePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [favoriteItemIds, setFavoriteItemIds] = useState<string[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(initialWeeklyPlan);
  const [familyName, setFamilyName] = useState<string>('My');

  const [suggestedAIItemNames, setSuggestedAIItemNames] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const [selectedItemForVariation, setSelectedItemForVariation] = useState<Item | null>(null);
  const [isVariationDialogOpen, setIsVariationDialogOpen] = useState(false);
  const [itemVariations, setItemVariations] = useState<string[]>([]);
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  const [orderedDaysForDisplay, setOrderedDaysForDisplay] = useState<DayOfWeek[]>(DAYS_OF_WEEK);

  const [weatherForecast, setWeatherForecast] = useState<DailyWeather[] | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  const [manualGroceryItems, setManualGroceryItems] = useState<ManualGroceryItem[]>([]);

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
    setOrderedDaysForDisplay(getRotatedDays());

    const storedFamilyName = localStorage.getItem('dinnertime_familyName');
    if (storedFamilyName) setFamilyName(storedFamilyName);
    else setFamilyName('My');

    const storedItems = localStorage.getItem('dinnertime_items');
    if (storedItems) setItems(JSON.parse(storedItems));
    
    const storedFavorites = localStorage.getItem('dinnertime_favoriteItemIds');
    if (storedFavorites) setFavoriteItemIds(JSON.parse(storedFavorites));
    
    const storedPlan = localStorage.getItem('dinnertime_weeklyPlan');
    if (storedPlan) {
      try {
        const parsedPlan = JSON.parse(storedPlan);
        const migratedPlan = DAYS_OF_WEEK.reduce((acc, day) => {
          const dayData = parsedPlan[day];
          if (dayData === null || (dayData && dayData.hasOwnProperty('id') && !dayData.hasOwnProperty('item'))) {
            acc[day] = { item: dayData as Item | null, note: '' };
          } else if (dayData && dayData.hasOwnProperty('item')) {
            acc[day] = {item: dayData.item, note: dayData.note || ''};
          } else { 
            acc[day] = { item: null, note: '' };
          }
          return acc;
        }, {} as WeeklyPlan);
        setWeeklyPlan(migratedPlan);
      } catch (e) {
        console.error("Failed to parse or migrate weekly plan from localStorage", e);
        setWeeklyPlan(initialWeeklyPlan);
      }
    } else {
      setWeeklyPlan(initialWeeklyPlan);
    }

    const storedManualGroceryItems = localStorage.getItem('dinnertime_manualGroceryItems');
    if (storedManualGroceryItems) setManualGroceryItems(JSON.parse(storedManualGroceryItems));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const forecast = await fetchWeatherForecast(latitude, longitude);
          setWeatherForecast(forecast);
          setIsLoadingWeather(false);
          if (!forecast) {
            toast({ title: "Weather Update", description: "Could not fetch weather data.", variant: "destructive" });
          }
        },
        (error) => {
          console.error("Error getting geolocation:", error);
          setIsLoadingWeather(false);
          toast({ title: "Location Error", description: "Could not get location for weather. Please ensure location services are enabled.", variant: "destructive" });
        }
      );
    } else {
      setIsLoadingWeather(false);
      toast({ title: "Location Error", description: "Geolocation is not supported by this browser.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'dinnertime_familyName' && event.newValue !== null) {
        setFamilyName(event.newValue);
      } else if (event.key === 'dinnertime_familyName' && event.newValue === null) {
        setFamilyName('My');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
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

  useEffect(() => {
    if(isClient) localStorage.setItem('dinnertime_manualGroceryItems', JSON.stringify(manualGroceryItems));
  }, [manualGroceryItems, isClient]);

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
      if (updatedPlan[day].item?.id === itemIdToDelete) {
        updatedPlan[day] = { ...updatedPlan[day], item: null };
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

  const handleUpdateDayInPlan = useCallback((day: DayOfWeek, newDayData: Partial<DayPlanData>) => {
    setWeeklyPlan(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        ...newDayData,
      }
    }));
  }, []);

  const handleGetSuggestions = async () => {
    if (items.length === 0) {
      toast({ title: "No Items", description: "Add some items first to get suggestions.", variant: "destructive" });
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      const result = await suggestItemsAI({ mealList: items.map(item => item.name) });
      setSuggestedAIItemNames(result.suggestedMeals); 
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
      type: itemType, 
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
        selectedMeal: selectedItemForVariation.name, 
        favoriteMeals: favoriteItemsForAI.map(i => i.name), 
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

  const handleAddManualGroceryItem = (name: string) => {
    if (name.trim() === '') {
      toast({ title: "Cannot Add Empty Item", description: "Please enter a name for the grocery item.", variant: "destructive" });
      return;
    }
    const newItem: ManualGroceryItem = { id: crypto.randomUUID(), name: name.trim() };
    setManualGroceryItems(prev => [...prev, newItem]);
    toast({ title: "Grocery Item Added", description: `"${name.trim()}" added to your shopping list.` });
  };

  const handleDeleteManualGroceryItem = (id: string) => {
    const itemToDelete = manualGroceryItems.find(item => item.id === id);
    setManualGroceryItems(prev => prev.filter(item => item.id !== id));
    if (itemToDelete) {
        toast({ title: "Grocery Item Removed", description: `"${itemToDelete.name}" removed from your shopping list.` });
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
      <header className="text-center py-8 non-printable-elements space-y-4">
        <div className="flex items-center justify-center">
          <ChefHat className="mr-4 h-12 w-12 md:h-16 md:w-16 text-primary" />
          <h1 className="text-5xl md:text-6xl font-headline text-primary">
            {familyName ? familyName + "'s" : "My"} DinnerTime
          </h1>
        </div>
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
            onUpdateDayData={handleUpdateDayInPlan}
            orderedDays={orderedDaysForDisplay}
            weatherForecast={weatherForecast}
            isLoadingWeather={isLoadingWeather}
          />
          <ShoppingList
            plan={weeklyPlan}
            manualItems={manualGroceryItems}
            onAddManualItem={handleAddManualGroceryItem}
            onDeleteManualItem={handleDeleteManualGroceryItem}
          />
          <div className="flex flex-col sm:flex-row justify-end items-center gap-2 non-printable-elements">
            <Link href="/settings" passHref>
              <Button variant="outline" size="icon" aria-label="Settings" className="w-full sm:w-auto">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <PrintButton />
            <ExportButton plan={weeklyPlan} items={items} orderedDays={orderedDaysForDisplay} manualGroceryItems={manualGroceryItems} />
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
