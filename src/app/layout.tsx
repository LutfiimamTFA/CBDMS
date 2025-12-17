
'use client';

import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const isShareRoute = pathname.startsWith('/share');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        {isShareRoute ? (
          // For share routes, use a minimal, isolated provider setup.
          // This avoids all internal app contexts (auth, company, permissions, etc).
           <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                <FirebaseClientProvider>
                  <SharedSessionProvider>
                      {children}
                  </SharedSessionProvider>
                </FirebaseClientProvider>
              </TooltipProvider>
              <Toaster />
            </ThemeProvider>
        ) : (
          // For the main app, use the full AppProviders.
          <AppProviders>
            {children}
          </AppProviders>
        )}
      </body>
    </html>
  );
}
