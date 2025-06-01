"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import type { WeeklyPlan } from '@/types';
import { useToast } from '@/hooks/use-toast';

interface ExportButtonProps {
  plan: WeeklyPlan;
}

const ExportButton: FC<ExportButtonProps> = ({ plan }) => {
  const { toast } = useToast();

  const handleExport = () => {
    let content = "DinnerTime - Weekly Meal Plan\n\n";
    Object.entries(plan).forEach(([day, meal]) => {
      content += `${day}: ${meal || 'Not planned'}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'dinnertime_plan.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);

    toast({
      title: "Plan Exported!",
      description: "Your weekly meal plan has been downloaded as a .txt file.",
    });
  };

  return (
    <Button onClick={handleExport} className="w-full md:w-auto">
      <Download className="mr-2 h-5 w-5" />
      Export Plan
    </Button>
  );
};

export default ExportButton;
