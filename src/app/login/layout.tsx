
'use client';

import React from 'react';

// This layout specifically wraps the login page.
// It no longer needs to provide any providers as they are handled
// by the root AppShell.
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
