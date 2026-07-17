import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DinnerTime - Weekly Meal Planner',
  description: 'Plan your weekly dinners with ease.',
};

export default function DinnerTimeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
