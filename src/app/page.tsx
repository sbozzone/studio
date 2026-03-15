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
import { ChefHat, Settings, NotebookText, ShoppingCart, Utensils } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  loadItems, saveItems,
  loadWeeklyPlanRaw, saveWeeklyPlan,
  loadFamilyName,
  loadCustomSubtitle,
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

// ── Mobile bottom-nav tab definitions ─────────────────────────────────────────
type MobileTab = 'planner' | 'shopping' | 'items';

const MOBILE_TABS: { id: MobileTab; label: string; Icon: React.ElementType }[] = [
  { id: 'planner',  label: 'Planner',  Icon: NotebookText },
  { id: 'shopping', label: 'Shopping', Icon: ShoppingCart },
  { id: 'items',    label: 'Items',    Icon: Utensils },
];

export default function DinnerTimePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(createEmptyPlan());
  const [familyName, setFamilyName] = useState<string>('My');
  const [customSubtitle, setCustomSubtitle] = useState<string>(DEFAULT_SUBTITLE);
  const [isClient, setIsClient] = useState(false);
  const [orderedDaysForDisplay, setOrderedDaysForDisplay] = useState<DayOfWeek[]>(DAYS_OF_WEEK);
  const [manualGroceryItems, setManualGroceryItems] = useState<ManualGroceryItem[]>([]);
  // Which section is visible on mobile (desktop always shows all three)
  const [activeTab, setActiveTab] = useState<MobileTab>('planner');

  const { toast } = useToast();

  // ── Hydration guard ──────────────────────────────────────────────────────────
  useEffect(() => { setIsClient(true); }, []);

  // ── Initial load from localStorage ──────────────────────────────────────────
  useEffect(() => {
    if (!isClient) return;

    setOrderedDaysForDisplay(getRotatedDays());
    setFamilyName(loadFamilyName());
    setCustomSubtitle(loadCustomSubtitle(DEFAULT_SUBTITLE));
    setItems(loadItems());
    setManualGroceryItems(loadManualGroceryItems());

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
  useEffect(() => {
    if (!isClient) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.familyName) {
        setFamilyName(event.newValue ?? 'My');
      } else if (event.key === STORAGE_KEYS.customSubtitle) {
        setCustomSubtitle(event.newValue ?? DEFAULT_SUBTITLE);
      } else if (event.key === STORAGE_KEYS.items && event.newValue !== null) {
        try { setItems(JSON.parse(event.newValue)); }
        catch (e) { console.error("Error parsing items from storage event", e); }
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
    setItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
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

    setItems(prev =>
      prev.map(i => (i.id === itemId ? { ...i, name: trimmedNewName } : i))
          .sort((a, b) => a.name.localeCompare(b.name))
    );

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

  // ── Manual grocery handlers ──────────────────────────────────────────────────

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
      <div className="flex flex-col justify-center items-center min-h-screen gap-4 non-printable-elements">
        <ChefHat className="h-12 w-12 animate-gentle-pulse text-primary" />
        <p className="text-lg font-headline text-muted-foreground">Loading DinnerTime…</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    // pb-24 leaves room for the fixed bottom nav on mobile (h-16 + safe-area).
    // lg:pb-8 restores normal padding when the bottom nav is hidden.
    <div className="container mx-auto py-3 pb-24 lg:py-8 lg:pb-8 space-y-4 lg:space-y-8 animate-fade-up">

      {/* ── Mobile app bar (hidden on desktop) ────────────────────────────────
          A slim sticky header with the branding on the left and a settings
          shortcut on the right — standard mobile app-bar pattern.           */}
      <div className="lg:hidden flex items-center justify-between py-1 non-printable-elements">
        <div className="flex items-center gap-2 min-w-0">
          <ChefHat className="h-7 w-7 text-primary flex-shrink-0" />
          <h1 className="text-xl font-headline text-primary truncate leading-tight">
            {familyName ? `${familyName}'s` : "My"} DinnerTime
          </h1>
        </div>
        <Link href="/settings" passHref>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Settings"
            className="h-11 w-11 flex-shrink-0 ml-2"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* ── Desktop header (hidden on mobile) ─────────────────────────────── */}
      <header className="hidden lg:block text-center py-8 non-printable-elements space-y-4">
        <div className="flex items-center justify-center">
          <ChefHat className="mr-4 h-12 w-12 md:h-16 md:w-16 text-primary" />
          <h1 className="text-5xl md:text-6xl font-headline text-primary">
            {familyName ? `${familyName}'s` : "My"} DinnerTime
          </h1>
        </div>
        <p className="text-base md:text-lg text-muted-foreground mt-2">{customSubtitle}</p>
      </header>

      {/* ── Main content area ─────────────────────────────────────────────────
          Mobile: one section visible at a time, controlled by activeTab.
          Desktop: all three columns visible simultaneously in a grid.       */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-8">

        {/* Items sidebar
            Mobile: visible only on the 'items' tab.
            Desktop: always visible in the left column.                      */}
        <aside className={cn(
          "space-y-4 lg:col-span-1 lg:space-y-6",
          activeTab === 'items' ? "block" : "hidden",
          "lg:block"
        )}>
          <ItemInputForm onAddItem={handleAddItem} />
          <ItemListDisplay
            items={items}
            onDeleteItem={handleDeleteItem}
            onEditItemName={handleEditItemName}
          />
        </aside>

        {/* Main section (planner + shopping list + action buttons)
            Each subsection is individually gated on mobile.                 */}
        <main id="printable-area" className="lg:col-span-2 space-y-4 lg:space-y-6">

          {/* Weekly planner — mobile: 'planner' tab only */}
          <div className={cn(
            activeTab === 'planner' ? "block" : "hidden",
            "lg:block"
          )}>
            <WeeklyPlannerGrid
              plan={weeklyPlan}
              allItems={items}
              onUpdateDayData={handleUpdateDayInPlan}
              orderedDays={orderedDaysForDisplay}
            />
          </div>

          {/* Shopping list — mobile: 'shopping' tab only */}
          <div className={cn(
            activeTab === 'shopping' ? "block" : "hidden",
            "lg:block"
          )}>
            <ShoppingList
              plan={weeklyPlan}
              manualItems={manualGroceryItems}
              onAddManualItem={handleAddManualGroceryItem}
              onDeleteManualItem={handleDeleteManualGroceryItem}
            />
          </div>

          {/* Print / Export actions — mobile: shown with planner tab */}
          <div className={cn(
            "flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-2 non-printable-elements",
            activeTab === 'planner' ? "flex" : "hidden",
            "lg:flex"
          )}>
            {/* Settings link shown inline on desktop; on mobile it's in the app bar */}
            <Link href="/settings" passHref className="hidden lg:block">
              <Button variant="outline" size="icon" aria-label="Settings">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <PrintButton />
            <ExportButton
              plan={weeklyPlan}
              items={items}
              orderedDays={orderedDaysForDisplay}
              manualGroceryItems={manualGroceryItems}
            />
          </div>
        </main>
      </div>

      {/* ── Mobile bottom navigation ───────────────────────────────────────────
          Fixed to the bottom of the viewport. Hidden on desktop (lg+).
          Uses env(safe-area-inset-bottom) to clear the iPhone home indicator. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-t border-border non-printable-elements pb-safe"
        aria-label="Main navigation"
      >
        <div className="flex items-stretch h-16">
          {MOBILE_TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={cn(
                // Generous touch target: flex-1 of 4 columns on a 360px screen ≈ 90px wide
                "flex-1 flex flex-col items-center justify-center gap-0.5",
                "transition-colors duration-150",
                activeTab === id
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[11px] font-medium leading-none">{label}</span>
            </button>
          ))}

          {/* Settings tab — navigates to the settings page */}
          <Link
            href="/settings"
            className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground active:text-foreground transition-colors duration-150"
          >
            <Settings className="h-5 w-5" />
            <span className="text-[11px] font-medium leading-none">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
