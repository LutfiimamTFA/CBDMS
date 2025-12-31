
'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase';

// This layout specifically wraps the login page to provide Firebase context
// without the other authenticated-user providers.
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FirebaseClientProvider>
        {children}
    </FirebaseClientProvider>
  );
}
