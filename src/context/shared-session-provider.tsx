
'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useDoc, useFirestore } from '@/firebase';
import type { SharedLink } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { useParams } from 'next/navigation';

interface SharedSessionContextType {
  session: SharedLink | null;
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
  const params = useParams();
  const firestore = useFirestore();
  const linkId = params.linkId as string | undefined;

  const linkDocRef = useMemo(() => {
    if (!firestore || !linkId) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: session, isLoading, error } = useDoc<SharedLink>(linkDocRef);

  const value = useMemo(
    () => ({
      session: session || null,
      isLoading,
      error,
    }),
    [session, isLoading, error]
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}
