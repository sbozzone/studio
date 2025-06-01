
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Settings as SettingsIcon } from 'lucide-react'; // Renamed to avoid conflict

export default function SettingsPage() {
  const [familyName, setFamilyName] = useState<string>('');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const storedFamilyName = localStorage.getItem('dinnertime_familyName');
    if (storedFamilyName) {
      setFamilyName(storedFamilyName);
    } else {
      setFamilyName('My'); // Default if nothing is stored
    }
  }, []);

  useEffect(() => {
    if (isClient) {
      localStorage.setItem('dinnertime_familyName', familyName);
    }
  }, [familyName, isClient]);

  const handleFamilyNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFamilyName(event.target.value);
  };

  if (!isClient) {
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
        <p className="text-lg text-muted-foreground mt-2">Customize your DinnerTime planner.</p>
      </header>

      <main className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline text-2xl">Planner Title</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="familyName">Family Name for Planner Title</Label>
            <Input
              id="familyName"
              type="text"
              value={familyName}
              onChange={handleFamilyNameChange}
              placeholder="E.g., Smith"
            />
            <p className="text-xs text-muted-foreground">
              This name will be used in the title, like &quot;{familyName ? familyName + "'s" : "My"} DinnerTime&quot;.
            </p>
          </CardContent>
        </Card>
        
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
