'use client';

import React from 'react';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from '@/components/theme-provider';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // This layout is completely isolated. It does NOT use FirebaseClientProvider.
    // It only provides the necessary context for the public share view.
    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
        <SharedSessionProvider>
          <SidebarProvider isSharedView={true}>
            {children}
          </SidebarProvider>
        </SharedSessionProvider>
    </ThemeProvider>
  );
}
