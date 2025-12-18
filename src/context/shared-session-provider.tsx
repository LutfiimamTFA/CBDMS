
'use client';

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { useDoc, useCollection, initializeFirebase } from '@/firebase';
import type { SharedLink, NavigationItem, Company, Task, WorkflowStatus, Brand, User } from '@/lib/types';
import { doc, collection, query, orderBy, getFirestore, type Firestore, where, type Query } from 'firebase/firestore';
import { useParams } from 'next/navigation';

interface SharedSessionContextType {
  session: SharedLink | null;
  navItems: NavigationItem[] | null;
  company: Company | null;
  tasks: Task[] | null;
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

// A lightweight, self-contained Firestore instance for the public share view.
let publicFirestore: Firestore | null = null;
function getPublicFirestore() {
    if (!publicFirestore) {
        publicFirestore = getFirestore(initializeFirebase().firebaseApp);
    }
    return publicFirestore;
}

export function SharedSessionProvider({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  
  useEffect(() => {
    setFirestore(getPublicFirestore());
  }, []);

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

  const companyDocRef = useMemo(() => {
    if (!firestore || !session?.companyId) return null;
    return doc(firestore, 'companies', session.companyId);
  }, [firestore, session?.companyId]);
  
  const { data: company, isLoading: isCompanyLoading, error: companyError } = useDoc<Company>(companyDocRef);

  // --- Data queries that depend on the session ---
  const tasksQuery = useMemo(() => {
    if (!firestore || !session?.companyId) return null;
    let q: Query = query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
    
    return q;
  }, [firestore, session]);
  const { data: tasks, isLoading: isTasksLoading, error: tasksError } = useCollection<Task>(tasksQuery);


  // --- Combined loading and error states ---
  const isLoading = 
    !firestore || 
    isSessionLoading || 
    isNavItemsLoading || 
    isCompanyLoading || 
    isTasksLoading;
    
  const error = sessionError || navItemsError || companyError || tasksError;

  const value = useMemo(
    () => ({
      session: session || null,
      navItems: navItems || null,
      company: company || null,
      tasks: tasks || null,
      isLoading,
      error,
    }),
    [session, navItems, company, tasks, isLoading, error]
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}
