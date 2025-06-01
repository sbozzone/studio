
"use client";

import { useState, useEffect } from 'react';
import MealInputForm from '@/components/dinnertime/meal-input-form';
import MealListDisplay from '@/components/dinnertime/meal-list-display';
import WeeklyPlannerGrid from '@/components/dinnertime/weekly-planner-grid';
import SmartSuggestionCTA from '@/components/dinnertime/smart-suggestion-cta';
import VariationGeneratorDialog from '@/components/dinnertime/variation-generator-dialog';
import ExportButton from '@/components/dinnertime/export-button';
import PrintButton from '@/components/dinnertime/print-button'; // New Import
import ShoppingList from '@/components/dinnertime/shopping-list'; // New Import
import { useToast } from '@/hooks/use-toast';
import type { DayOfWeek, WeeklyPlan } from '@/types';
import { DAYS_OF_WEEK } from '@/types';
import { ChefHat } from 'lucide-react';
import { suggestMeals as suggestMealsAI } from '@/ai/flows/smart-suggestion';
import { generateMealVariations as generateMealVariationsAI } from '@/ai/flows/variation-generation';

export default function DinnerTimePage() {
  const [meals, setMeals] = useState<string[]>([]);
  const [favoriteMeals, setFavoriteMeals] = useState<string[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(
    DAYS_OF_WEEK.reduce((acc, day) => ({ ...acc, [day]: null }), {} as WeeklyPlan)
  );

  const [suggestedAITeals, setSuggestedAIMeals] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  const [selectedMealForVariation, setSelectedMealForVariation] = useState<string | null>(null);
  const [isVariationDialogOpen, setIsVariationDialogOpen] = useState(false);
  const [mealVariations, setMealVariations] = useState<string[]>([]);
  const [isLoadingVariations, setIsLoadingVariations] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
    // Load from localStorage if available
    const storedMeals = localStorage.getItem('dinnertime_meals');
    if (storedMeals) setMeals(JSON.parse(storedMeals));
    const storedFavorites = localStorage.getItem('dinnertime_favoriteMeals');
    if (storedFavorites) setFavoriteMeals(JSON.parse(storedFavorites));
    const storedPlan = localStorage.getItem('dinnertime_weeklyPlan');
    if (storedPlan) setWeeklyPlan(JSON.parse(storedPlan));
  }, []);

  useEffect(() => {
    if(isClient) localStorage.setItem('dinnertime_meals', JSON.stringify(meals));
  }, [meals, isClient]);

  useEffect(() => {
    if(isClient) localStorage.setItem('dinnertime_favoriteMeals', JSON.stringify(favoriteMeals));
  }, [favoriteMeals, isClient]);

  useEffect(() => {
    if(isClient) localStorage.setItem('dinnertime_weeklyPlan', JSON.stringify(weeklyPlan));
  }, [weeklyPlan, isClient]);


  const { toast } = useToast();

  const handleAddMeal = (mealName: string) => {
    if (!meals.includes(mealName)) {
      setMeals((prev) => [...prev, mealName].sort());
      toast({ title: "Meal Added!", description: `"${mealName}" has been added to your meal list.` });
    } else {
      toast({ title: "Already Exists", description: `"${mealName}" is already in your list.`, variant: "destructive" });
    }
  };

  const handleDeleteMeal = (mealName: string) => {
    setMeals(prev => prev.filter(m => m !== mealName));
    setFavoriteMeals(prev => prev.filter(m => m !== mealName));
    // Also remove from weekly plan if it's there
    const updatedPlan = { ...weeklyPlan };
    let planChanged = false;
    for (const day of DAYS_OF_WEEK) {
      if (updatedPlan[day] === mealName) {
        updatedPlan[day] = null;
        planChanged = true;
      }
    }
    if (planChanged) setWeeklyPlan(updatedPlan);
    toast({ title: "Meal Deleted", description: `"${mealName}" has been removed.`});
  };

  const handleToggleFavorite = (mealName: string) => {
    setFavoriteMeals((prev) =>
      prev.includes(mealName)
        ? prev.filter((fav) => fav !== mealName)
        : [...prev, mealName]
    );
    toast({
      title: favoriteMeals.includes(mealName) ? "Unfavorited" : "Favorited!",
      description: `"${mealName}" has been ${favoriteMeals.includes(mealName) ? 'removed from' : 'added to'} favorites.`,
    });
  };

  const handleUpdatePlan = (day: DayOfWeek, mealName: string | null) => {
    setWeeklyPlan((prev) => ({ ...prev, [day]: mealName }));
  };

  const handleGetSuggestions = async () => {
    if (meals.length === 0) {
      toast({ title: "No Meals", description: "Add some meals first to get suggestions.", variant: "destructive" });
      return;
    }
    setIsLoadingSuggestions(true);
    try {
      const result = await suggestMealsAI({ mealList: meals });
      setSuggestedAIMeals(result.suggestedMeals);
      if (result.suggestedMeals.length > 0) {
        toast({ title: "Suggestions Ready!", description: "Check out these meal ideas." });
      } else {
        toast({ title: "No Suggestions Found", description: "Couldn't find any suggestions right now." });
      }
    } catch (error) {
      console.error("Error getting suggestions:", error);
      toast({ title: "Error", description: "Could not fetch meal suggestions.", variant: "destructive" });
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleSelectForVariation = (mealName: string) => {
    setSelectedMealForVariation(mealName);
    setMealVariations([]); // Clear previous variations
    setIsVariationDialogOpen(true);
  };

  const handleGenerateVariations = async () => {
    if (!selectedMealForVariation) return;
    setIsLoadingVariations(true);
    try {
      const result = await generateMealVariationsAI({
        selectedMeal: selectedMealForVariation,
        favoriteMeals: favoriteMeals,
      });
      setMealVariations(result.variations);
      if (result.variations.length > 0) {
        toast({ title: "Variations Generated!", description: `New ideas for "${selectedMealForVariation}" are ready.` });
      } else {
        toast({ title: "No Variations Found", description: `Couldn't find variations for "${selectedMealForVariation}".` });
      }
    } catch (error) {
      console.error("Error generating variations:", error);
      toast({ title: "Error", description: "Could not generate meal variations.", variant: "destructive" });
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
        <p className="text-lg text-muted-foreground mt-2">Plan your weekly dinners with appetite and comfort.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <MealInputForm onAddMeal={handleAddMeal} />
          <MealListDisplay
            meals={meals}
            favoriteMeals={favoriteMeals}
            onToggleFavorite={handleToggleFavorite}
            onSelectForVariation={handleSelectForVariation}
            onDeleteMeal={handleDeleteMeal}
          />
          <SmartSuggestionCTA
            onGetSuggestions={handleGetSuggestions}
            suggestions={suggestedAITeals}
            isLoading={isLoadingSuggestions}
            onAddSuggestedMeal={handleAddMeal}
          />
        </aside>

        <main id="printable-area" className="lg:col-span-2 space-y-6">
          <WeeklyPlannerGrid
            plan={weeklyPlan}
            allMeals={meals}
            onUpdatePlan={handleUpdatePlan}
          />
          <ShoppingList plan={weeklyPlan} />
          <div className="flex flex-col sm:flex-row justify-end gap-2 non-printable-elements">
            <PrintButton />
            <ExportButton plan={weeklyPlan} />
          </div>
        </main>
      </div>

      <VariationGeneratorDialog
        isOpen={isVariationDialogOpen}
        onOpenChange={setIsVariationDialogOpen}
        selectedMeal={selectedMealForVariation}
        favoriteMeals={favoriteMeals}
        onGenerateVariations={handleGenerateVariations}
        variations={mealVariations}
        isLoading={isLoadingVariations}
        className="non-printable-elements"
      />
    </div>
  );
}
