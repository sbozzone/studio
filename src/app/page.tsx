
"use client";

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Import useRouter
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth
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
import { ChefHat, Settings, LogOut } from 'lucide-react'; // Added LogOut

const getRotatedDays = (): DayOfWeek[] => {
  const todayIndex = new Date().getDay();
  const startIndexInDaysOfWeek = (todayIndex === 0) ? 6 : todayIndex - 1;
  return [
    ...DAYS_OF_WEEK.slice(startIndexInDaysOfWeek),
    ...DAYS_OF_WEEK.slice(0, startIndexInDaysOfWeek)
  ];
};

const initialWeeklyPlan = DAYS_OF_WEEK.reduce((acc, day) => {
  acc[day] = { entree: null, side1: null, side2: null, note: '' };
  return acc;
}, {} as WeeklyPlan);

const DEFAULT_SUBTITLE = "Effortlessly plan your dinners for the week.";

export default function DinnerTimePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(initialWeeklyPlan);
  const [familyName, setFamilyName] = useState<string>('My');
  const [customSubtitle, setCustomSubtitle] = useState<string>(DEFAULT_SUBTITLE);
  
  const [isClient, setIsClient] = useState(false);
  const [orderedDaysForDisplay, setOrderedDaysForDisplay] = useState<DayOfWeek[]>(DAYS_OF_WEEK);

  const [manualGroceryItems, setManualGroceryItems] = useState<ManualGroceryItem[]>([]);

  const { toast } = useToast();
  const { user, loading, signOut } = useAuth(); // Get auth state
  const router = useRouter(); // Get router instance

  useEffect(() => {
    setIsClient(true); // Ensure client-side only execution for localStorage and auth checks
  }, []);
  
  useEffect(() => {
    if (isClient) { // Only run on client
        if (!loading && !user) {
            router.push('/login'); // Redirect if not logged in and not loading
        } else if (user) {
            // User is logged in, load data from localStorage (for now)
            // In the future, this is where you'd fetch from Firestore
            setOrderedDaysForDisplay(getRotatedDays());

            const storedFamilyName = localStorage.getItem('dinnertime_familyName');
            if (storedFamilyName) setFamilyName(storedFamilyName);
            else setFamilyName('My');

            const storedSubtitle = localStorage.getItem('dinnertime_customSubtitle');
            if (storedSubtitle) setCustomSubtitle(storedSubtitle);
            else setCustomSubtitle(DEFAULT_SUBTITLE);

            const storedItems = localStorage.getItem('dinnertime_items');
            if (storedItems) setItems(JSON.parse(storedItems));
            
            const storedPlan = localStorage.getItem('dinnertime_weeklyPlan');
            if (storedPlan) {
              try {
                const parsedPlan = JSON.parse(storedPlan);
                const migratedPlan = DAYS_OF_WEEK.reduce((acc, day) => {
                  acc[day] = { entree: null, side1: null, side2: null, note: '' }; 
                  const dayData = parsedPlan[day];

                  if (dayData) {
                    if (dayData.hasOwnProperty('entree') || dayData.hasOwnProperty('side1') || dayData.hasOwnProperty('side2')) {
                      acc[day].entree = dayData.entree || null;
                      acc[day].side1 = dayData.side1 || null;
                      acc[day].side2 = dayData.side2 || null;
                      acc[day].note = dayData.note || '';
                    } 
                    else if (dayData.hasOwnProperty('item')) {
                      const oldItem = dayData.item as Item | null;
                      if (oldItem) {
                        if (oldItem.type === 'entree') {
                          acc[day].entree = oldItem;
                        } else if (oldItem.type === 'side') {
                          acc[day].side1 = oldItem; 
                        }
                      }
                      acc[day].note = dayData.note || '';
                    }
                    else if (dayData.hasOwnProperty('id') && dayData.hasOwnProperty('name') && dayData.hasOwnProperty('type')) {
                         const oldSingleItem = dayData as Item;
                         if (oldSingleItem.type === 'entree') {
                            acc[day].entree = oldSingleItem;
                         } else if (oldSingleItem.type === 'side') {
                            acc[day].side1 = oldSingleItem;
                         }
                    }
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
        }
    }
  }, [user, loading, router, toast, isClient]);


  useEffect(() => {
    if (!isClient) return; // Ensure this only runs client-side
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'dinnertime_familyName') {
        setFamilyName(event.newValue !== null ? event.newValue : 'My');
      } else if (event.key === 'dinnertime_customSubtitle') {
        setCustomSubtitle(event.newValue !== null ? event.newValue : DEFAULT_SUBTITLE);
      } else if (event.key === 'dinnertime_items') {
        if (event.newValue !== null) {
            try {
                const newItems = JSON.parse(event.newValue);
                setItems(newItems);
            } catch (e) {
                console.error("Error parsing items from storage event", e);
            }
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isClient]);

  useEffect(() => {
    if(isClient && user) localStorage.setItem('dinnertime_items', JSON.stringify(items));
  }, [items, isClient, user]);

  useEffect(() => {
    if(isClient && user) localStorage.setItem('dinnertime_weeklyPlan', JSON.stringify(weeklyPlan));
  }, [weeklyPlan, isClient, user]);

  useEffect(() => {
    if(isClient && user) localStorage.setItem('dinnertime_manualGroceryItems', JSON.stringify(manualGroceryItems));
  }, [manualGroceryItems, isClient, user]);

  const handleAddItem = (newItem: Item) => {
    if (!items.some(item => item.name.toLowerCase() === newItem.name.toLowerCase() && item.type === newItem.type)) {
      setItems((prev) => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      toast({ title: "Item Added!", description: `"${newItem.name} (${newItem.type})" has been added.` });
    } else {
      toast({ title: "Already Exists", description: `"${newItem.name} (${newItem.type})" is already in your list.`, variant: "destructive" });
    }
  };

  const handleEditItemName = (itemId: string, newName: string) => {
    const trimmedNewName = newName.trim();
    if (!trimmedNewName) {
      toast({ title: "Invalid Name", description: "Item name cannot be empty.", variant: "destructive" });
      return;
    }

    const originalItem = items.find(i => i.id === itemId);
    if (!originalItem) return;

    const isDuplicate = items.some(
      item => item.id !== itemId && item.name.toLowerCase() === trimmedNewName.toLowerCase() && item.type === originalItem.type
    );

    if (isDuplicate) {
      toast({
        title: "Name Already Exists",
        description: `An item named "${trimmedNewName}" of type "${originalItem.type}" already exists.`,
        variant: "destructive",
      });
      return;
    }

    setItems(prevItems =>
      prevItems
        .map(i => (i.id === itemId ? { ...i, name: trimmedNewName } : i))
        .sort((a, b) => a.name.localeCompare(b.name))
    );

    setWeeklyPlan(prevPlan => {
      const updatedPlan = { ...prevPlan };
      for (const day of DAYS_OF_WEEK) {
        const dayData = { ...updatedPlan[day] };
        let changed = false;
        if (dayData.entree?.id === itemId) {
          dayData.entree = { ...dayData.entree, name: trimmedNewName };
          changed = true;
        }
        if (dayData.side1?.id === itemId) {
          dayData.side1 = { ...dayData.side1, name: trimmedNewName };
          changed = true;
        }
        if (dayData.side2?.id === itemId) {
          dayData.side2 = { ...dayData.side2, name: trimmedNewName };
          changed = true;
        }
        if (changed) {
          updatedPlan[day] = dayData;
        }
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
      let dayModified = false;
      const currentDayPlan = updatedPlan[day];
      const newDayPlanData = { ...currentDayPlan };

      if (newDayPlanData.entree?.id === itemIdToDelete) {
        newDayPlanData.entree = null;
        dayModified = true;
      }
      if (newDayPlanData.side1?.id === itemIdToDelete) {
        newDayPlanData.side1 = null;
        dayModified = true;
      }
      if (newDayPlanData.side2?.id === itemIdToDelete) {
        newDayPlanData.side2 = null;
        dayModified = true;
      }

      if (dayModified) {
        updatedPlan[day] = newDayPlanData;
        planChanged = true;
      }
    }
    if (planChanged) setWeeklyPlan(updatedPlan);
    toast({ title: "Item Deleted", description: `"${itemToDelete.name}" has been removed.`});
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
  
  if (loading || !user || !isClient) { // Show loading if auth is loading, no user, or not client-side yet
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
