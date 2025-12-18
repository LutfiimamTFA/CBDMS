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
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  users: User[] | null;
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
    if (session.brandIds && session.brandIds.length > 0) {
      q = query(q, where('brandId', 'in', session.brandIds));
    } else if (session.creatorRole !== 'Super Admin') {
      return null;
    }
    return q;
  }, [firestore, session]);
  const { data: tasks, isLoading: isTasksLoading, error: tasksError } = useCollection<Task>(tasksQuery);

  const statusesQuery = useMemo(() => {
    if (!firestore || !session?.companyId) return null;
    return query(collection(firestore, 'statuses'), where('companyId', '==', session.companyId), orderBy('order'));
  }, [firestore, session?.companyId]);
  const { data: statuses, isLoading: areStatusesLoading, error: statusesError } = useCollection<WorkflowStatus>(statusesQuery);
  
  const brandsQuery = useMemo(() => {
    if (!firestore || !session?.companyId) return null;
    let q: Query = query(collection(firestore, 'brands'), where('companyId', '==', session.companyId), orderBy('name'));
    if (session.brandIds && session.brandIds.length > 0) {
      q = query(q, where('__name__', 'in', session.brandIds));
    }
    return q;
  }, [firestore, session]);
  const { data: brands, isLoading: areBrandsLoading, error: brandsError } = useCollection<Brand>(brandsQuery);
  
  const usersQuery = useMemo(() => {
    if (!firestore || !session?.companyId) return null;
    return query(collection(firestore, 'users'), where('companyId', '==', session.companyId));
  }, [firestore, session?.companyId]);
  const { data: users, isLoading: areUsersLoading, error: usersError } = useCollection<User>(usersQuery);

  // --- Combined loading and error states ---
  const isLoading = 
    !firestore || 
    isSessionLoading || 
    isNavItemsLoading || 
    isCompanyLoading || 
    isTasksLoading ||
    areStatusesLoading ||
    areBrandsLoading ||
    areUsersLoading;
    
  const error = sessionError || navItemsError || companyError || tasksError || statusesError || brandsError || usersError;

  const value = useMemo(
    () => ({
      session: session || null,
      navItems: navItems || null,
      company: company || null,
      tasks: tasks || null,
      statuses: statuses || null,
      brands: brands || null,
      users: users || null,
      isLoading,
      error,
    }),
    [session, navItems, company, tasks, statuses, brands, users, isLoading, error]
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}
