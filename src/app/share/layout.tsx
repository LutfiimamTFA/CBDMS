'use client';

import React from 'react';
import { SharedSessionProvider } from '@/context/shared-session-provider';
import { SidebarProvider } from '@/components/ui/sidebar';

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
