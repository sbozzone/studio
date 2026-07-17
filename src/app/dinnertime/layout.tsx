import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'DinnerTime - Weekly Meal Planner',
  description: 'Plan your weekly dinners with ease.',
};

export const viewport: Viewport = {
  themeColor: '#FF7F50', // DinnerTime keeps its Warm Coral browser chrome
};

export default function DinnerTimeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="theme-dinnertime min-h-dvh bg-background text-foreground">
      {children}
    </div>
  );
}
