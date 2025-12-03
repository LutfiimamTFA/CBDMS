'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { useDoc, useFirestore, useUserProfile } from '@/firebase';
import type { Company } from '@/lib/types';
import { doc } from 'firebase/firestore';

interface CompanyContextType {
  company: Company | null;
  isLoading: boolean;
  error: Error | null;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const { profile, isLoading: isProfileLoading } = useUserProfile();

  const companyDocRef = useMemo(() => {
    if (!firestore || !profile?.companyId) return null;
    return doc(firestore, 'companies', profile.companyId);
  }, [firestore, profile?.companyId]);

  const { data: company, isLoading: isCompanyLoading, error } = useDoc<Company>(companyDocRef);

  const isLoading = isProfileLoading || isCompanyLoading;

  const value = useMemo(
    () => ({
      company,
      isLoading,
      error,
    }),
    [company, isLoading, error]
  );

  return (
    <CompanyContext.Provider value={value}>
      {children}
    </CompanyContext.Provider>
  );
}
