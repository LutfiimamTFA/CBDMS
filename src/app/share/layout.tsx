'use client';

import React from 'react';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { SidebarProvider } from '@/components/ui/sidebar';

// This layout now correctly wraps the shared pages with necessary providers.
export default function ShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
      <SharedSessionProvider>
        <SidebarProvider isSharedView={true}>
          {children}
        </SidebarProvider>
      </SharedSessionProvider>
  );
}
