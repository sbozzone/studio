
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/AuthContext'; // Import AuthProvider

export const metadata: Metadata = {
  title: 'DinnerTime - Weekly Meal Planner',
  description: 'Plan your weekly dinners with ease.',
  icons: {
    icon: '/favicon.ico', // Points to /public/favicon.ico
    // You can add other types like:
    // apple: '/apple-touch-icon.png', // Points to /public/apple-touch-icon.png
    // shortcut: '/favicon-16x16.png', // Points to /public/favicon-16x16.png
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log('[Layout Server Component] Checking Firebase Project ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Next.js will automatically handle link tags for favicons defined in metadata */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Alegreya:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Belleza&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased" suppressHydrationWarning>
        <AuthProvider> {/* Wrap children with AuthProvider */}
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
