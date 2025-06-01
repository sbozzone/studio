
"use client";

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PrintButton: FC = () => {
  const { toast } = useToast();

  const handlePrint = () => {
    toast({
      title: "Printing...",
      description: "Your weekly plan and shopping list are being prepared for printing.",
    });
    window.print();
  };

  return (
    <Button onClick={handlePrint} className="w-full md:w-auto" variant="outline">
      <Printer className="mr-2 h-5 w-5" />
      Print Plan & List
    </Button>
  );
};

export default PrintButton;
