"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Settings as SettingsIcon, Edit3 } from 'lucide-react';
import ItemCsvUploadForm from '@/components/dinnertime/item-csv-upload-form';
import type { Item } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  loadFamilyName, saveFamilyName,
  loadCustomSubtitle, saveCustomSubtitle,
  loadItems, saveItems,
  STORAGE_KEYS,
} from '@/lib/storage';
import { isDuplicateItem } from '@/lib/plan-utils';

const DEFAULT_SUBTITLE = "Effortlessly plan your dinners for the week.";

export default function SettingsPage() {
  const [familyName, setFamilyName] = useState<string>('');
  const [customSubtitle, setCustomSubtitle] = useState<string>(DEFAULT_SUBTITLE);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  // ── Hydration guard ──────────────────────────────────────────────────────────
  useEffect(() => { setIsClient(true); }, []);

  // ── Load persisted settings on mount ────────────────────────────────────────
  useEffect(() => {
    if (!isClient) return;
    setFamilyName(loadFamilyName());
    setCustomSubtitle(loadCustomSubtitle(DEFAULT_SUBTITLE));
  }, [isClient]);

  // ── Persist settings whenever they change ───────────────────────────────────
  useEffect(() => { if (isClient) saveFamilyName(familyName); }, [familyName, isClient]);
  useEffect(() => { if (isClient) saveCustomSubtitle(customSubtitle); }, [customSubtitle, isClient]);

  // ── Bulk CSV import ──────────────────────────────────────────────────────────
  /**
   * Called by ItemCsvUploadForm after it parses the file.
   * Reads the current item list directly from localStorage so this function
   * doesn't need to be wired into page-level state, then merges new items,
   * persists, and dispatches a StorageEvent so the main planner page (if open
   * in another tab) can pick up the change immediately.
   */
  const handleBulkAddItems = (
    newItemsFromFile: Array<Omit<Item, 'id'>>
  ): { addedCount: number; duplicateCount: number } => {
    if (!isClient) return { addedCount: 0, duplicateCount: 0 };

    const currentItems = loadItems();
    let addedCount = 0;
    let duplicateCount = 0;
    const itemsToAdd: Item[] = [];

    newItemsFromFile.forEach((itemFromFile) => {
      if (isDuplicateItem(itemFromFile, currentItems)) {
        duplicateCount++;
      } else {
        itemsToAdd.push({ ...itemFromFile, id: crypto.randomUUID() });
        addedCount++;
      }
    });

    if (itemsToAdd.length > 0) {
      const updatedItems = [...currentItems, ...itemsToAdd].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      saveItems(updatedItems);

      // Notify the main page tab via the storage event API
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: STORAGE_KEYS.items,
          newValue: JSON.stringify(updatedItems),
        })
      );
    }

    toast({
      title: "CSV Processed",
      description: `${addedCount} item(s) added. ${duplicateCount} duplicate(s) skipped. Items will refresh on the main planner page.`,
    });

    return { addedCount, duplicateCount };
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (!isClient) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <SettingsIcon className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl font-headline">Loading Settings...</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 min-h-screen flex flex-col items-center">
      <header className="text-center py-8 space-y-4 w-full max-w-2xl">
        <div className="flex items-center justify-center">
          <SettingsIcon className="mr-4 h-12 w-12 md:h-16 md:w-16 text-primary" />
          <h1 className="text-5xl md:text-6xl font-headline text-primary">Settings</h1>
        </div>
        <p className="text-base md:text-lg text-muted-foreground mt-2">Customize your DinnerTime planner.</p>
      </header>

      <main className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl md:text-2xl flex items-center">
              <Edit3 className="mr-2 h-5 w-5 opacity-70" />
              Planner Customization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="familyName">Family Name for Planner Title</Label>
              <Input
                id="familyName"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="E.g., Smith"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This name will be used in the title, like &quot;{familyName ? familyName + "'s" : "My"} DinnerTime&quot;.
              </p>
            </div>
            <div>
              <Label htmlFor="customSubtitle">Planner Subtitle</Label>
              <Input
                id="customSubtitle"
                type="text"
                value={customSubtitle}
                onChange={(e) => setCustomSubtitle(e.target.value)}
                placeholder="Enter your custom subtitle"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This text appears below the main planner title.
              </p>
            </div>
          </CardContent>
        </Card>

        <ItemCsvUploadForm onBulkAddItems={handleBulkAddItems} />

        <Link href="/" passHref>
          <Button variant="outline" className="w-full">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Planner
          </Button>
        </Link>
      </main>

      <footer className="py-8 mt-auto text-center text-muted-foreground text-sm">
        DinnerTime App
      </footer>
    </div>
  );
}
