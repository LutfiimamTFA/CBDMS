
'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import type { SharedLink } from '@/lib/types';
import { doc } from 'firebase/firestore';

interface SharedSession {
    role: 'Manager' | 'Employee' | 'Client';
    companyId: string;
    linkId: string;
}

interface SharedSessionContextType {
  session: SharedSession | null;
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
  const firestore = useFirestore();
  const params = useParams();
  const linkId = params?.linkId as string | undefined;

  const linkDocRef = useMemo(() => {
    if (!firestore || !linkId) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: sharedLink, isLoading, error } = useDoc<SharedLink>(linkDocRef);
  
  const session = useMemo((): SharedSession | null => {
    if (sharedLink) {
        return {
            role: sharedLink.sharedAsRole,
            companyId: sharedLink.companyId,
            linkId: sharedLink.id,
        };
    }
    return null;
  }, [sharedLink]);

  const value = useMemo(
    () => ({
      session,
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
