
'use client';

import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { FirebaseClientProvider } from '@/firebase';

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

  const isAppPage = APP_ROUTES.some(route => pathname.startsWith(route));
  const isSharePage = pathname.startsWith('/share');

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
          <AppProviders>
            {children}
          </AppProviders>
        ) : isSharePage ? (
          // For share pages, render children within a minimal provider setup
          // to ensure complete isolation from the main app's providers.
          <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                  {children}
              </TooltipProvider>
              <Toaster />
          </ThemeProvider>
        ) : (
          // For other public pages (login, etc.), use a minimal provider setup.
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
