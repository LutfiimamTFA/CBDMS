'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { I18nProvider } from '@/context/i18n-provider';
import { FirebaseClientProvider } from '@/firebase';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <I18nProvider>
        <FirebaseClientProvider>
          <TooltipProvider>
            {children}
            <Toaster />
          </TooltipProvider>
        </FirebaseClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
