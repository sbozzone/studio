"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { WeeklyPlan, Item, DayOfWeek, ManualGroceryItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { aggregatePlanItems } from '@/lib/plan-utils';

interface ExportButtonProps {
  plan: WeeklyPlan;
  items: Item[];
  orderedDays: DayOfWeek[];
  manualGroceryItems: ManualGroceryItem[];
}

const ExportButton: FC<ExportButtonProps> = ({ plan, orderedDays, manualGroceryItems }) => {
  const { toast } = useToast();

  const handleExport = () => {
    // ── Build weekly plan section ──────────────────────────────────────────────
    let content = "DinnerTime - Weekly Plan & Shopping List\n\n";
    content += "== Weekly Plan ==\n";

    orderedDays.forEach(day => {
      const dayPlan = plan[day];
      content += `${day}:\n`;
      content += dayPlan.entree
        ? `  Entree: ${dayPlan.entree.name} (${dayPlan.entree.type})\n`
        : '  Entree: Not planned\n';
      content += dayPlan.side1
        ? `  Side 1: ${dayPlan.side1.name} (${dayPlan.side1.type})\n`
        : '  Side 1: Not planned\n';
      content += dayPlan.side2
        ? `  Side 2: ${dayPlan.side2.name} (${dayPlan.side2.type})\n`
        : '  Side 2: Not planned\n';
      if (dayPlan.note) content += `  Note: ${dayPlan.note}\n`;
      content += "\n";
    });

    // ── Build shopping list section ────────────────────────────────────────────
    // Reuse the same aggregation utility used by ShoppingList so both always agree
    content += "\n== Shopping List ==\n";
    const aggregated = aggregatePlanItems(plan);

    if (aggregated.length > 0) {
      content += "From Plan:\n";
      aggregated.forEach(item => {
        content += `- ${item.displayText}${item.count > 1 ? ` (x${item.count})` : ''}\n`;
      });
    }

    if (manualGroceryItems.length > 0) {
      if (aggregated.length > 0) content += "\n";
      content += "Manual Additions:\n";
      manualGroceryItems.forEach(item => { content += `- ${item.name}\n`; });
    }

    if (aggregated.length === 0 && manualGroceryItems.length === 0) {
      content += "No items in shopping list.\n";
    }

    // ── Trigger file download ──────────────────────────────────────────────────
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
