
'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useParams } from 'next/navigation';

// This context is no longer needed with the granular permission model.
// The share page will handle its own logic based on the link data.

interface SharedSessionContextType {
  session: null;
  isLoading: boolean;
  error: Error | null;
}

const SharedSessionContext = createContext<SharedSessionContextType | undefined>(undefined);

export function useSharedSession() {
  const context = useContext(SharedSessionContext);
  if (context === undefined) {
    throw new Error('useSharedSession must be used within a SharedSessionProvider');
  }
  return context;
}

export function SharedSessionProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo(
    () => ({
      session: null,
      isLoading: false,
      error: null,
    }),
    []
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}
