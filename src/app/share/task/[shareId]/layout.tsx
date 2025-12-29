
'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';

// This is a completely isolated layout for the single-task share view.
// It does NOT use the complex SharedSessionProvider or Sidebar.
export default function ShareTaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
    >
        <FirebaseClientProvider>
            {children}
             <Toaster />
        </FirebaseClientProvider>
    </ThemeProvider>
  );
}
