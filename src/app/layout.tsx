
'use client';

import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FirebaseClientProvider } from '@/firebase';

// Define public routes that do not need full AppProviders
const APP_ROUTES = [
  '/dashboard',
  '/tasks',
  '/my-work',
  '/reports',
  '/calendar',
  '/schedule',
  '/social-media',
  '/admin',
  '/settings',
  '/guide',
  '/daily-report',
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Determine if the current route is a main application page
  const isAppPage = APP_ROUTES.some(route => pathname.startsWith(route));

  if (!isMounted) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className="font-body antialiased"></body>
        </html>
    )
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        {isAppPage ? (
          // For the main protected app, use the full AppProviders.
          <AppProviders>
            {children}
          </AppProviders>
        ) : (
          // For public pages (login, share, etc.), use a minimal provider setup.
          // This avoids contexts that require authentication.
           <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                <FirebaseClientProvider>
                  {children}
                </FirebaseClientProvider>
              </TooltipProvider>
              <Toaster />
            </ThemeProvider>
        )}
      </body>
    </html>
  );
}
