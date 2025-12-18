'use client';

import React from 'react';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { FirebaseClientProvider } from '@/firebase';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from '@/components/theme-provider';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // This layout provides a completely isolated context for the share feature.
    // It does not use AppProviders or any other global application providers.
    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
      <FirebaseClientProvider>
        <SharedSessionProvider>
          <SidebarProvider isSharedView={true}>
            {children}
          </SidebarProvider>
        </SharedSessionProvider>
      </FirebaseClientProvider>
    </ThemeProvider>
  );
}
