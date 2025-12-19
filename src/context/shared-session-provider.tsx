'use client';

import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { initializeFirebase } from '@/firebase';
import type { SharedLink, NavigationItem, Company, Task, WorkflowStatus, Brand, User } from '@/lib/types';
import { doc, getFirestore, type Firestore, onSnapshot } from 'firebase/firestore';
import { useParams } from 'next/navigation';

interface SharedSessionContextType {
  session: SharedLink | null;
  navItems: NavigationItem[] | null;
  company: Company | null;
  tasks: Task[] | null;
  users: User[] | null;
  statuses: WorkflowStatus[] | null;
  brands: Brand[] | null;
  isLoading: boolean;
  error: Error | null;
  setSharedTasks: React.Dispatch<React.SetStateAction<Task[] | null>>;
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
  const [sharedTasks, setSharedTasks] = useState<Task[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const firestore = useMemo(() => getPublicFirestore(), []);

  useEffect(() => {
    if (!firestore || !linkId) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    const linkDocRef = doc(firestore, 'sharedLinks', linkId);

    const unsubscribe = onSnapshot(linkDocRef, 
      async (docSnap) => {
        if (docSnap.exists()) {
          const sessionData = { ...docSnap.data(), id: docSnap.id } as SharedLink;
          setSession(sessionData);
          setSharedTasks(sessionData.snapshot.tasks);

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
          setSharedTasks(null);
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
  }, [firestore, linkId]);

  const value = useMemo(
    () => ({
      session,
      navItems: session?.navItems || [],
      company: company || null,
      tasks: sharedTasks, // Use the state variable here
      users: session?.snapshot?.users || [],
      statuses: session?.snapshot?.statuses || [],
      brands: session?.snapshot?.brands || [],
      isLoading,
      error,
      setSharedTasks,
    }),
    [session, company, sharedTasks, isLoading, error]
  );

  return (
    <SharedSessionContext.Provider value={value}>
      {children}
    </SharedSessionContext.Provider>
  );
}
