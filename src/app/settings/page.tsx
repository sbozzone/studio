
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Settings as SettingsIcon, Edit3, UploadCloud, LogOut, UserCircle } from 'lucide-react';
import ItemCsvUploadForm from '@/components/dinnertime/item-csv-upload-form';
import type { Item, ItemType } from '@/types';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_SUBTITLE = "Effortlessly plan your dinners for the week.";

export default function SettingsPage() {
  const [familyName, setFamilyName] = useState<string>('');
  const [customSubtitle, setCustomSubtitle] = useState<string>(DEFAULT_SUBTITLE);
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
    if (isClient && user) { // Ensure user is loaded before accessing localStorage
        const storedFamilyName = localStorage.getItem('dinnertime_familyName');
        if (storedFamilyName) {
        setFamilyName(storedFamilyName);
        } else {
        setFamilyName('My'); 
        }

        const storedSubtitle = localStorage.getItem('dinnertime_customSubtitle');
        if (storedSubtitle) {
        setCustomSubtitle(storedSubtitle);
        } else {
        setCustomSubtitle(DEFAULT_SUBTITLE);
        }
    }
  }, [isClient, user]); // Add user to dependency array

  useEffect(() => {
    if (isClient && user) {
      localStorage.setItem('dinnertime_familyName', familyName);
    }
  }, [familyName, isClient, user]);

  useEffect(() => {
    if (isClient && user) {
      localStorage.setItem('dinnertime_customSubtitle', customSubtitle);
    }
  }, [customSubtitle, isClient, user]);

  const handleFamilyNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFamilyName(event.target.value);
  };

  const handleSubtitleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setCustomSubtitle(event.target.value);
  };

  const handleBulkAddItems = (newItemsFromFile: Array<Omit<Item, 'id'>>): { addedCount: number, duplicateCount: number } => {
    if (!isClient || !user) return { addedCount: 0, duplicateCount: 0 }; // Check for user

    let addedCount = 0;
    let duplicateCount = 0;
    const itemsToAdd: Item[] = [];
    
    const storedItemsRaw = localStorage.getItem('dinnertime_items');
    const currentItems: Item[] = storedItemsRaw ? JSON.parse(storedItemsRaw) : [];

    newItemsFromFile.forEach(itemFromFile => {
      if (!currentItems.some(existingItem => existingItem.name.toLowerCase() === itemFromFile.name.toLowerCase() && existingItem.type === itemFromFile.type)) {
        itemsToAdd.push({
          ...itemFromFile,
          id: crypto.randomUUID(),
        });
        addedCount++;
      } else {
        duplicateCount++;
      }
    });

    if (itemsToAdd.length > 0) {
      const updatedItems = [...currentItems, ...itemsToAdd].sort((a, b) => a.name.localeCompare(b.name));
      localStorage.setItem('dinnertime_items', JSON.stringify(updatedItems));
       // Dispatch storage event so main page can pick up changes if it's open
      window.dispatchEvent(new StorageEvent('storage', { key: 'dinnertime_items', newValue: JSON.stringify(updatedItems) }));
    }
    
    toast({
      title: "CSV Processed",
      description: `${addedCount} item(s) added. ${duplicateCount} duplicate(s) skipped. Items will refresh on the main planner page.`,
    });
    return { addedCount, duplicateCount };
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({ title: "Signed Out", description: "You have been successfully signed out." });
      router.push('/login');
    } catch (error) {
      console.error("Sign out error on settings page:", error);
      toast({ title: "Sign Out Failed", description: "Could not sign you out. Please try again.", variant: "destructive" });
    }
  };

  if (loading || !user || !isClient) { // Also check for isClient
    return (
      <div className="flex justify-center items-center min-h-screen">
        <SettingsIcon className="h-12 w-12 animate-spin text-primary" />
        <p className="ml-4 text-xl font-headline">Loading Settings...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 min-h-screen flex flex-col items-center">
      <header className="text-center py-8 space-y-4 w-full max-w-2xl">
        <div className="flex items-center justify-center">
          <SettingsIcon className="mr-4 h-12 w-12 md:h-16 md:w-16 text-primary" />
          <h1 className="text-5xl md:text-6xl font-headline text-primary">
            Settings
          </h1>
        </div>
        <p className="text-base md:text-lg text-muted-foreground mt-2">Customize your DinnerTime planner.</p>
      </header>

      <main className="w-full max-w-md space-y-6">
        {user && (
            <Card>
                <CardHeader>
                    <CardTitle className="font-headline text-xl md:text-2xl flex items-center">
                        <UserCircle className="mr-2 h-5 w-5 opacity-70" />
                        Account
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-sm">Logged in as: <span className="font-medium">{user.email}</span></p>
                    <Button onClick={handleSignOut} variant="outline" className="w-full">
                        <LogOut className="mr-2 h-5 w-5" />
                        Sign Out
                    </Button>
                </CardContent>
            </Card>
        )}

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
                onChange={handleFamilyNameChange}
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
                onChange={handleSubtitleChange}
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
        DinnerTime App - {user ? user.email : 'Logged Out'}
      </footer>
    </div>
  );
}
