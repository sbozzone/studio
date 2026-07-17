import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dew Point — How Humid Does It Feel?',
  description:
    'Calculates the current dew point from your local conditions and rates it on the standard comfort scale, from dry to oppressive.',
};

export default function DewPointLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
