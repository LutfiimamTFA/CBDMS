'use client';

import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { I18nProvider } from '@/context/i18n-provider';
import { FirebaseClientProvider } from '@/firebase';
import { PermissionsProvider } from '@/context/permissions-provider';
import { CompanyProvider } from '@/context/company-provider';
import { SharedSessionProvider } from '@/context/shared-session-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <I18nProvider>
        <FirebaseClientProvider>
          <SharedSessionProvider>
            <CompanyProvider>
              <PermissionsProvider>
                {children}
              </PermissionsProvider>
            </CompanyProvider>
          </SharedSessionProvider>
        </FirebaseClientProvider>
        <Toaster />
      </I18nProvider>
    </ThemeProvider>
  );
}
