"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ItemInputForm from '@/components/dinnertime/item-input-form';
import ItemListDisplay from '@/components/dinnertime/item-list-display';
import WeeklyPlannerGrid from '@/components/dinnertime/weekly-planner-grid';
import ExportButton from '@/components/dinnertime/export-button';
import PrintButton from '@/components/dinnertime/print-button';
import ShoppingList from '@/components/dinnertime/shopping-list';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import type { DayOfWeek, WeeklyPlan, Item, DayPlanData, ManualGroceryItem } from '@/types';
import { DAYS_OF_WEEK } from '@/types';
import { ChefHat, Settings } from 'lucide-react';
import {
  loadItems, saveItems,
  loadWeeklyPlanRaw, saveWeeklyPlan,
  loadFamilyName, saveFamilyName,
  loadCustomSubtitle, saveCustomSubtitle,
  loadManualGroceryItems, saveManualGroceryItems,
  STORAGE_KEYS,
} from '@/lib/storage';
import {
  createEmptyPlan,
  getRotatedDays,
  isDuplicateItem,
  migrateLegacyPlan,
} from '@/lib/plan-utils';

const DEFAULT_SUBTITLE = "Effortlessly plan your dinners for the week.";

export default function DinnerTimePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(createEmptyPlan());
  const [familyName, setFamilyName] = useState<string>('My');
  const [customSubtitle, setCustomSubtitle] = useState<string>(DEFAULT_SUBTITLE);
  const [isClient, setIsClient] = useState(false);
  const [orderedDaysForDisplay, setOrderedDaysForDisplay] = useState<DayOfWeek[]>(DAYS_OF_WEEK);
  const [manualGroceryItems, setManualGroceryItems] = useState<ManualGroceryItem[]>([]);

  const { toast } = useToast();

  // ── Hydration guard ──────────────────────────────────────────────────────────
  // Next.js renders on the server first. We only access localStorage after
  // the component mounts on the client.
  useEffect(() => {
    setIsClient(true);
  }, []);

  // ── Initial load from localStorage ──────────────────────────────────────────
  useEffect(() => {
    if (!isClient) return;

    // Start showing today's day first in the planner grid
    setOrderedDaysForDisplay(getRotatedDays());

    setFamilyName(loadFamilyName());
    setCustomSubtitle(loadCustomSubtitle(DEFAULT_SUBTITLE));
    setItems(loadItems());
    setManualGroceryItems(loadManualGroceryItems());

    // Weekly plan needs migration in case the stored format is from an older version
    const raw = loadWeeklyPlanRaw();
    if (raw) {
      try {
        setWeeklyPlan(migrateLegacyPlan(raw));
      } catch (e) {
        console.error("Failed to migrate weekly plan from localStorage", e);
        setWeeklyPlan(createEmptyPlan());
      }
    } else {
      setWeeklyPlan(createEmptyPlan());
    }
  }, [isClient]);

  // ── Cross-tab sync ───────────────────────────────────────────────────────────
  // When the settings page (a different tab) updates family name, subtitle, or
  // items via a synthetic StorageEvent, this listener picks up the changes.
  useEffect(() => {
    if (!isClient) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.familyName) {
        setFamilyName(event.newValue ?? 'My');
      } else if (event.key === STORAGE_KEYS.customSubtitle) {
        setCustomSubtitle(event.newValue ?? DEFAULT_SUBTITLE);
      } else if (event.key === STORAGE_KEYS.items && event.newValue !== null) {
        try {
          setItems(JSON.parse(event.newValue));
        } catch (e) {
          console.error("Error parsing items from storage event", e);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isClient]);

  // ── Persist state to localStorage on change ──────────────────────────────────
  useEffect(() => { if (isClient) saveItems(items); }, [items, isClient]);
  useEffect(() => { if (isClient) saveWeeklyPlan(weeklyPlan); }, [weeklyPlan, isClient]);
  useEffect(() => { if (isClient) saveManualGroceryItems(manualGroceryItems); }, [manualGroceryItems, isClient]);

  // ── Item handlers ────────────────────────────────────────────────────────────

  const handleAddItem = (newItem: Item) => {
    if (isDuplicateItem(newItem, items)) {
      toast({ title: "Already Exists", description: `"${newItem.name} (${newItem.type})" is already in your list.`, variant: "destructive" });
      return;
    }
    setItems((prev) => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    toast({ title: "Item Added!", description: `"${newItem.name} (${newItem.type})" has been added.` });
  };

  const handleEditItemName = (itemId: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
      toast({ title: "Invalid Name", description: "Item name cannot be empty.", variant: "destructive" });
      return;
    }

    const originalItem = items.find(i => i.id === itemId);
    if (!originalItem) return;

    if (isDuplicateItem({ name: trimmedNewName, type: originalItem.type }, items, itemId)) {
      toast({
        title: "Name Already Exists",
        description: `An item named "${trimmedNewName}" of type "${originalItem.type}" already exists.`,
        variant: "destructive",
      });
      return;
    }

    // Update the item list
    setItems(prev =>
      prev
        .map(i => (i.id === itemId ? { ...i, name: trimmedNewName } : i))
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    // Also update any occurrences already placed in the weekly plan so they
    // reflect the new name immediately without a page reload.
    setWeeklyPlan(prevPlan => {
      const updatedPlan = { ...prevPlan };
      for (const day of DAYS_OF_WEEK) {
        const dayData = { ...updatedPlan[day] };
        let changed = false;
        if (dayData.entree?.id === itemId) { dayData.entree = { ...dayData.entree, name: trimmedNewName }; changed = true; }
        if (dayData.side1?.id === itemId)  { dayData.side1  = { ...dayData.side1,  name: trimmedNewName }; changed = true; }
        if (dayData.side2?.id === itemId)  { dayData.side2  = { ...dayData.side2,  name: trimmedNewName }; changed = true; }
        if (changed) updatedPlan[day] = dayData;
      }
      return updatedPlan;
    });

    toast({ title: "Item Updated", description: `"${originalItem.name}" is now "${trimmedNewName}".` });
  };

  const handleDeleteItem = (itemIdToDelete: string) => {
    const itemToDelete = items.find(i => i.id === itemIdToDelete);
    if (!itemToDelete) return;

    setItems(prev => prev.filter(i => i.id !== itemIdToDelete));

    // Clear the deleted item from any day it was placed on
    const updatedPlan = { ...weeklyPlan };
    let planChanged = false;
    for (const day of DAYS_OF_WEEK) {
      const current = { ...updatedPlan[day] };
      let dayModified = false;
      if (current.entree?.id === itemIdToDelete) { current.entree = null; dayModified = true; }
      if (current.side1?.id === itemIdToDelete)  { current.side1  = null; dayModified = true; }
      if (current.side2?.id === itemIdToDelete)  { current.side2  = null; dayModified = true; }
      if (dayModified) { updatedPlan[day] = current; planChanged = true; }
    }
    if (planChanged) setWeeklyPlan(updatedPlan);

    toast({ title: "Item Deleted", description: `"${itemToDelete.name}" has been removed.` });
  };

  // ── Plan handler ─────────────────────────────────────────────────────────────

  const handleUpdateDayInPlan = useCallback((day: DayOfWeek, newDayData: Partial<DayPlanData>) => {
    setWeeklyPlan(prev => ({
      ...prev,
      [day]: { ...prev[day], ...newDayData },
    }));
  }, []);

  // ── Manual grocery item handlers ─────────────────────────────────────────────

  const handleAddManualGroceryItem = (name: string) => {
    if (!name.trim()) {
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

  // ── Loading state ────────────────────────────────────────────────────────────

  if (!isClient) {
    return (
      <div className="flex justify-center items-center min-h-screen non-printable-elements">
        <ChefHat className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl font-headline">Loading DinnerTime...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8">
      <header className="text-center py-8 non-printable-elements space-y-4">
        <div className="flex items-center justify-center">
          <ChefHat className="mr-4 h-12 w-12 md:h-16 md:w-16 text-primary" />
          <h1 className="text-5xl md:text-6xl font-headline text-primary">
            {familyName ? familyName + "'s" : "My"} DinnerTime
          </h1>
        </div>
        <p className="text-base md:text-lg text-muted-foreground mt-2">{customSubtitle}</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-8">
        <aside className="lg:col-span-1 space-y-6">
          <ItemInputForm onAddItem={handleAddItem} />
          <ItemListDisplay
            items={items}
            onDeleteItem={handleDeleteItem}
            onEditItemName={handleEditItemName}
          />
        </aside>

        <main id="printable-area" className="lg:col-span-2 space-y-6">
          <WeeklyPlannerGrid
            plan={weeklyPlan}
            allItems={items}
            onUpdateDayData={handleUpdateDayInPlan}
            orderedDays={orderedDaysForDisplay}
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
    </div>
  );
}
