
'use client';

import { usePathname } from 'next/navigation';

// This list defines which routes are part of the main authenticated application.
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

  // Check if the current path starts with any of the defined app routes.
  const isAppPage = APP_ROUTES.some(route => pathname.startsWith(route));

  // For any other page (e.g., /login, /, /force-password-change, or the isolated /share route),
  // return the children directly. These routes manage their own, simpler provider setups
  // within their specific layouts (e.g., src/app/share/layout.tsx).
  return <>{children}</>;
}
