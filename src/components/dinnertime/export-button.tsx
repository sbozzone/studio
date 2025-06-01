
"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { WeeklyPlan, Item } from '@/types'; // Item added
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  plan: WeeklyPlan;
  items: Item[]; // Added to potentially list all available items if needed, though not used in current export logic
}

const ExportButton: FC<ExportButtonProps> = ({ plan }) => {
  const { toast } = useToast();

  const handleExport = () => {
    let content = "DinnerTime - Weekly Plan\n\n";
    Object.entries(plan).forEach(([day, item]) => {
      content += `${day}: ${item ? `${item.name} (${item.type})` : 'Not planned'}\n`;
    });

    // Optionally add shopping list to export
    const itemsInPlan = Object.values(plan).filter(item => item !== null) as Item[];
    const itemCounts: Record<string, { count: number; type: string }> = {};
    itemsInPlan.forEach(item => {
      const key = `${item.name} (${item.type})`;
      if (itemCounts[key]) {
        itemCounts[key].count++;
      } else {
        itemCounts[key] = { count: 1, type: item.type };
      }
    });
    const uniqueItemsWithCounts = Object.entries(itemCounts)
      .map(([nameAndType, data]) => ({
        displayText: nameAndType,
        count: data.count,
      }))
      .sort((a, b) => a.displayText.localeCompare(b.displayText));

    if (uniqueItemsWithCounts.length > 0) {
      content += "\n\nShopping List:\n";
      uniqueItemsWithCounts.forEach(item => {
        content += `- ${item.displayText} ${item.count > 1 ? `(x${item.count})` : ''}\n`;
      });
    }


    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dinnertime_plan_and_list.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    toast({
      title: "Plan & List Exported!",
      description: "Your weekly plan and shopping list have been downloaded as a .txt file.",
    });
  };

  return (
    <Button onClick={handleExport} className="w-full md:w-auto">
      <Download className="mr-2 h-5 w-5" />
      Export Plan & List
    </Button>
  );
};

export default ExportButton;
