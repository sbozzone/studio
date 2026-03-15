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
import { cn } from '@/lib/utils';

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
  const handleBulkAddItems = (
    newItemsFromFile: Array<Omit<Item, 'id'>>
  ): { addedCount: number; duplicateCount: number } => {
    if (!isClient) return { addedCount: 0, duplicateCount: 0 };

    const currentItems = loadItems();
    let addedCount = 0;
    let duplicateCount = 0;
    const itemsToAdd: Item[] = [];

    newItemsFromFile.forEach(itemFromFile => {
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
      window.dispatchEvent(
        new StorageEvent('storage', { key: STORAGE_KEYS.items, newValue: JSON.stringify(updatedItems) })
      );
    }

    toast({
      title: "CSV Processed",
      description: `${addedCount} item(s) added. ${duplicateCount} duplicate(s) skipped.`,
    });

    return { addedCount, duplicateCount };
  };

  // ── Loading state ────────────────────────────────────────────────────────────

  if (!isClient) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-4">
        <SettingsIcon className="h-10 w-10 animate-gentle-pulse text-primary" />
        <p className="text-lg font-headline text-muted-foreground">Loading Settings…</p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className={cn(
      "container mx-auto min-h-screen flex flex-col",
      "pb-6 lg:py-8"          // Extra bottom padding so last card isn't flush on mobile
    )}>

      {/* ── Mobile app bar ──────────────────────────────────────────────────────
          A sticky top bar with a back-arrow on the left and page title centred.
          Replaces the oversized desktop header on small screens.             */}
      <div className="lg:hidden sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center h-14 px-1">
          <Link href="/" passHref>
            <Button variant="ghost" size="icon" aria-label="Back to planner" className="h-11 w-11">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="flex-1 text-center text-lg font-headline text-primary pr-11">
            Settings
          </h1>
        </div>
      </div>

      {/* ── Desktop header (hidden on mobile) ─────────────────────────────── */}
      <header className="hidden lg:block text-center py-8 space-y-4">
        <div className="flex items-center justify-center">
          <SettingsIcon className="mr-4 h-12 w-12 md:h-16 md:w-16 text-primary" />
          <h1 className="text-5xl md:text-6xl font-headline text-primary">Settings</h1>
        </div>
        <p className="text-base md:text-lg text-muted-foreground">Customize your DinnerTime planner.</p>
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-md mx-auto space-y-4 lg:space-y-6 pt-4 lg:pt-0 animate-fade-up">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-xl md:text-2xl flex items-center">
              <Edit3 className="mr-2 h-5 w-5 opacity-70" />
              Planner Customization
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="familyName">Family Name for Planner Title</Label>
              <Input
                id="familyName"
                type="text"
                value={familyName}
                onChange={e => setFamilyName(e.target.value)}
                placeholder="E.g., Smith"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Displays as &quot;{familyName ? `${familyName}'s` : "My"} DinnerTime&quot;.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="customSubtitle">Planner Subtitle</Label>
              <Input
                id="customSubtitle"
                type="text"
                value={customSubtitle}
                onChange={e => setCustomSubtitle(e.target.value)}
                placeholder="Enter your custom subtitle"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Appears below the main planner title.
              </p>
            </div>
          </CardContent>
        </Card>

        <ItemCsvUploadForm onBulkAddItems={handleBulkAddItems} />

        {/* Back button — desktop only; mobile uses the app bar back arrow */}
        <Link href="/" passHref className="hidden lg:block">
          <Button variant="outline" className="w-full h-11">
            <ArrowLeft className="mr-2 h-5 w-5" />
            Back to Planner
          </Button>
        </Link>
      </main>

      <footer className="hidden lg:block py-8 text-center text-muted-foreground text-sm">
        DinnerTime App
      </footer>
    </div>
  );
}
