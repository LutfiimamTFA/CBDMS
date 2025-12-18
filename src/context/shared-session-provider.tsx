
'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import type { SharedLink, NavigationItem } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { useParams } from 'next/navigation';

interface SharedSessionContextType {
  session: SharedLink | null;
  navItems: NavigationItem[] | null;
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

  const { data: session, isLoading: isSessionLoading, error: sessionError } = useDoc<SharedLink>(linkDocRef);

  const navItemsQuery = useMemo(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'navigationItems'), orderBy('order'));
  }, [firestore]);

  const { data: navItems, isLoading: isNavItemsLoading, error: navItemsError } = useCollection<NavigationItem>(navItemsQuery);

  const isLoading = isSessionLoading || isNavItemsLoading;
  const error = sessionError || navItemsError;

  const value = useMemo(
    () => ({
      session: session || null,
      navItems: navItems || null,
      isLoading,
      error,
    }),
    [session, navItems, isLoading, error]
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}
