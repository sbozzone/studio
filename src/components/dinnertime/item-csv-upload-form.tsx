
"use client";

import type { FC } from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { UploadCloud, FileText } from 'lucide-react';
import type { Item, ItemType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label'; // Added import for standard Label

interface ItemCsvUploadFormProps {
  onBulkAddItems: (items: Array<Omit<Item, 'id'>>) => { addedCount: number, duplicateCount: number };
}

const ItemCsvUploadForm: FC<ItemCsvUploadFormProps> = ({ onBulkAddItems }) => {
  const [fileName, setFileName] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setFileName(null);
      return;
    }

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a .csv file.",
        variant: "destructive",
      });
      setFileName(null);
      event.target.value = ''; // Clear the input
      return;
    }
    
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        try {
          const parsedItems: Array<Omit<Item, 'id'>> = [];
          const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== ''); // Filter out empty lines
          
          // Skip header if present (optional, simple check for "name" and "type" in first line)
          const firstLine = lines[0]?.toLowerCase();
          const hasHeader = firstLine && (firstLine.includes('name') || firstLine.includes('type'));
          const dataLines = hasHeader ? lines.slice(1) : lines;

          dataLines.forEach((line, index) => {
            const values = line.split(',').map(v => v.trim());
            const name = values[0];
            let type = values[1]?.toLowerCase() as ItemType | undefined;

            if (!name) {
              console.warn(`Skipping line ${index + (hasHeader ? 2 : 1)}: Name is missing.`);
              return; // Skip if name is empty
            }

            if (type && type !== 'entree' && type !== 'side') {
              console.warn(`Invalid type "${type}" on line ${index + (hasHeader ? 2 : 1)}. Defaulting to 'entree'.`);
              type = 'entree';
            } else if (!type) {
              type = 'entree';
            }
            
            parsedItems.push({ name, type });
          });

          if (parsedItems.length > 0) {
            const { addedCount, duplicateCount } = onBulkAddItems(parsedItems);
            toast({
              title: "CSV Processed",
              description: `${addedCount} item(s) added. ${duplicateCount} duplicate(s) skipped.`,
            });
          } else {
            toast({
              title: "CSV Empty or Invalid",
              description: "No valid items found in the CSV file.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error("Error parsing CSV:", error);
          toast({
            title: "CSV Parsing Error",
            description: "Could not process the CSV file. Please check its format.",
            variant: "destructive",
          });
        }
      }
       // Clear the file input after processing
      event.target.value = '';
      setFileName(null);
    };
    reader.onerror = () => {
        toast({
            title: "File Read Error",
            description: "Could not read the selected file.",
            variant: "destructive",
        });
        event.target.value = '';
        setFileName(null);
    };
    reader.readAsText(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center font-headline text-2xl">
          <UploadCloud className="mr-2 h-6 w-6 text-primary" />
          Upload Items (CSV)
        </CardTitle>
        <CardDescription>
          Upload a list of items from a CSV file.
          Format: Column 1 for Item Name, Column 2 (optional) for Item Type ('entree' or 'side').
          A header row (e.g., "Name,Type") is optional and will be skipped if detected.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col items-start space-y-2">
            <Label htmlFor="csv-upload" className="sr-only">Upload CSV file</Label>
            <Input
                id="csv-upload"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            />
            {fileName && (
            <div className="text-xs text-muted-foreground flex items-center">
                <FileText className="mr-1 h-3 w-3" /> Selected: {fileName}
            </div>
            )}
        </div>
         <p className="text-xs text-muted-foreground">
            Example line: <code className="bg-muted p-0.5 rounded-sm">Spaghetti Carbonara,entree</code> or <code className="bg-muted p-0.5 rounded-sm">Garlic Bread</code> (defaults to entree).
        </p>
      </CardContent>
    </Card>
  );
};

// Removed the inline Label definition that was causing the "React is not defined" error.
// The standard Label component is now imported from '@/components/ui/label'.

export default ItemCsvUploadForm;
