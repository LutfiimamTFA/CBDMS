'use client';

import { usePathname } from 'next/navigation';
import { AppProviders } from '@/components/app-providers';

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Determine if the current page is part of the main authenticated application
  const isAppPage = APP_ROUTES.some(route => pathname.startsWith(route));

  // If it's an app page, wrap it with all the necessary providers.
  if (isAppPage) {
    return <AppProviders>{children}</AppProviders>;
  }

  // For any other page (public pages like login, /, or the isolated /share route),
  // return the children directly without any of the main app's providers.
  // The specific layouts for these routes (e.g., share/layout.tsx) will handle their own minimal providers.
  return <>{children}</>;
}
