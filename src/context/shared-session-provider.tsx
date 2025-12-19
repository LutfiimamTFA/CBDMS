
'use client';

import React, { createContext, useContext, useMemo, useEffect, useState, useCallback } from 'react';
import { initializeFirebase } from '@/firebase';
import type { SharedLink, Company } from '@/lib/types';
import { doc, getFirestore, type Firestore, onSnapshot } from 'firebase/firestore';
import { useParams } from 'next/navigation';

interface SharedSessionContextType {
  session: SharedLink | null;
  company: Company | null;
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

let publicFirestore: Firestore | null = null;
function getPublicFirestore() {
    if (!publicFirestore) {
        publicFirestore = getFirestore(initializeFirebase().firebaseApp);
    }
    return publicFirestore;
}

export function SharedSessionProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const linkId = params.linkId as string | undefined;

  const [session, setSession] = useState<SharedLink | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const firestore = useMemo(() => getPublicFirestore(), []);

  const handleLegacyLink = useCallback(async (linkId: string) => {
    try {
        const response = await fetch('/api/share/migrate-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ linkId }),
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to migrate link.');
        }
    } catch (migrationError: any) {
        console.error("Migration failed:", migrationError);
        setError(migrationError);
    }
  }, []);

  useEffect(() => {
    if (!firestore || !linkId) {
      setIsLoading(false);
      return;
    }
    
    const token = sessionStorage.getItem(`share_token_${linkId}`);
    if (session?.password && !token) {
        setIsLoading(false);
        return;
    }
    
    setIsLoading(true);
    const linkDocRef = doc(firestore, 'sharedLinks', linkId);

    const unsubscribe = onSnapshot(linkDocRef, 
      async (docSnap) => {
        if (docSnap.exists()) {
          const sessionData = { ...docSnap.data(), id: docSnap.id } as SharedLink;

          if (sessionData.password && !sessionStorage.getItem(`share_token_${linkId}`)) {
              setError(new Error("Authentication required."));
              setSession(null);
              setIsLoading(false);
              return;
          }

          // Legacy link detection and one-time migration
          if (!sessionData.snapshot.statuses || sessionData.snapshot.statuses.length === 0) {
              await handleLegacyLink(linkId);
              // The onSnapshot listener will be re-triggered with the updated data,
              // so we can wait for the next snapshot instead of setting state here.
              return; 
          }

          setSession(sessionData);

          if (sessionData.companyId) {
            const companyDocRef = doc(firestore, 'companies', sessionData.companyId);
            onSnapshot(companyDocRef, (companySnap) => {
                if (companySnap.exists()) {
                    setCompany({ ...companySnap.data(), id: companySnap.id } as Company);
                }
            });
          }
          setError(null);
        } else {
          setError(new Error("Share link not found or has been disabled."));
          setSession(null);
        }
        setIsLoading(false);
      }, 
      (err) => {
        console.error("Error fetching shared link:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firestore, linkId, session?.password, handleLegacyLink]);

  const value = useMemo(
    () => ({
      session,
      company: company || null,
      isLoading,
      error,
    }),
    [session, company, isLoading, error]
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}
