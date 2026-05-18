
'use client';

import React from 'react';

// This is a completely isolated layout for the single-task share view.
// It does NOT use the complex SharedSessionProvider or Sidebar.
export default function ShareTaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
