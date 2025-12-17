
'use client';

import { usePathname } from 'next/navigation';
import { FirebaseClientProvider } from '@/firebase';
import { ThemeProvider } from './theme-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  // This component now only provides the most basic, universal providers
  // that are safe for both public and private routes.
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
