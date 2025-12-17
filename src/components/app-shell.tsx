
'use client';

import { usePathname } from 'next/navigation';
import { AppProviders } from '@/components/app-providers';
import { FirebaseClientProvider } from '@/firebase';
import { ThemeProvider } from './theme-provider';

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

const SHARE_ROUTE = '/share';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAppPage = APP_ROUTES.some(route => pathname.startsWith(route));
  const isSharePage = pathname.startsWith(SHARE_ROUTE);

  if (isAppPage) {
    return <AppProviders>{children}</AppProviders>;
  }
  
  if (isSharePage) {
    return (
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </ThemeProvider>
    )
  }

  // Fallback for public pages like login, /, etc.
  return (
    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
        <FirebaseClientProvider>{children}</FirebaseClientProvider>
    </ThemeProvider>
  );
}
