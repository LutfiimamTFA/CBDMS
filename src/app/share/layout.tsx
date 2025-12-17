
'use client';

import React from 'react';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { FirebaseClientProvider } from '@/firebase';
import { SidebarProvider } from '@/components/ui/sidebar';

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // This layout provides a completely isolated Firebase context for the share feature.
    <FirebaseClientProvider>
      <SharedSessionProvider>
        <SidebarProvider isSharedView={true}>
          {children}
        </SidebarProvider>
      </SharedSessionProvider>
    </FirebaseClientProvider>
  );
}
