
"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { WeeklyPlan, Item, DayOfWeek, DayPlanData, ManualGroceryItem } from '@/types'; 
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  plan: WeeklyPlan;
  items: Item[]; 
  orderedDays: DayOfWeek[];
  manualGroceryItems: ManualGroceryItem[];
}

const ExportButton: FC<ExportButtonProps> = ({ plan, orderedDays, manualGroceryItems }) => {
  const { toast } = useToast();

  const handleExport = () => {
    let content = "DinnerTime - Weekly Plan & Shopping List\n\n";
    content += "== Weekly Plan ==\n";
    orderedDays.forEach(day => {
      const dayPlan: DayPlanData = plan[day];
      const itemText = dayPlan.item ? `${dayPlan.item.name} (${dayPlan.item.type})` : 'Not planned';
      content += `${day}: ${itemText}\n`;
      if (dayPlan.note) {
        content += `  Note: ${dayPlan.note}\n`;
      }
    });

    content += "\n== Shopping List ==\n";
    
    const itemsInPlan = Object.values(plan)
                            .map((dayData: DayPlanData) => dayData.item)
                            .filter(item => item !== null) as Item[];

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
      content += "From Plan:\n";
      uniqueItemsWithCounts.forEach(item => {
        content += `- ${item.displayText} ${item.count > 1 ? `(x${item.count})` : ''}\n`;
      });
    }

    if (manualGroceryItems.length > 0) {
      if (uniqueItemsWithCounts.length > 0) content += "\n"; // Add space if planned items exist
      content += "Manual Additions:\n";
      manualGroceryItems.forEach(item => {
        content += `- ${item.name}\n`;
      });
    }

    if (uniqueItemsWithCounts.length === 0 && manualGroceryItems.length === 0) {
      content += "No items in shopping list.\n";
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
