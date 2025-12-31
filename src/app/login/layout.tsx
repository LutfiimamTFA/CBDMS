
'use client';

import React from 'react';

// This layout specifically wraps the login page to provide Firebase context
// without the other authenticated-user providers.
// Note: It no longer needs to provide FirebaseClientProvider directly,
// as that is now handled by the root AppShell.
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
