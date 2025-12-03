'use client';

import { useCompany } from '@/context/company-provider';
import { Briefcase, Loader2 } from 'lucide-react';

export function Logo() {
  const { company, isLoading } = useCompany();

  return (
    <div className="flex items-center gap-2">
      <div className="bg-primary p-2 rounded-lg">
        {company?.logoUrl ? (
           <img src={company.logoUrl} alt="Company Logo" className="h-5 w-auto" />
        ) : (
          <Briefcase className="h-5 w-5 text-primary-foreground" />
        )}
      </div>
      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <h1 className="font-headline text-xl font-bold truncate">{company?.name || 'WorkWise'}</h1>
      )}
    </div>
  );
}
