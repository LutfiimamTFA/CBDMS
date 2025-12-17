
'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { I18nProvider } from '@/context/i18n-provider';
import { FirebaseClientProvider } from '@/firebase';
import { PermissionsProvider } from '@/context/permissions-provider';
import { CompanyProvider } from '@/context/company-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <I18nProvider>
          <FirebaseClientProvider>
              <CompanyProvider>
                <PermissionsProvider>
                  {children}
                </PermissionsProvider>
              </CompanyProvider>
          </FirebaseClientProvider>
          <Toaster />
        </I18nProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
