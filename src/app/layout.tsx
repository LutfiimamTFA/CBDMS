
'use client';

import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Define public routes that should not use AppProviders
const PUBLIC_ROUTES = [
  '/login',
  '/check-email',
  '/force-password-change',
  '/force-acknowledge-tasks',
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

  // Determine if the current route is a public-facing page
  const isPublicPage =
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith('/share') ||
    pathname === '/';

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
        {isPublicPage ? (
          // For public pages, use a minimal provider setup.
          // This avoids contexts that require authentication (auth, company, permissions, etc).
           <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <TooltipProvider>
                {/* FirebaseClientProvider can be included here if public pages need basic firebase access without auth context */}
                {children}
              </TooltipProvider>
              <Toaster />
            </ThemeProvider>
        ) : (
          // For the main protected app, use the full AppProviders.
          <AppProviders>
            {children}
          </AppProviders>
        )}
      </body>
    </html>
  );
}
