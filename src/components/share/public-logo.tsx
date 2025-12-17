
'use client';

import { Briefcase, Loader2 } from 'lucide-react';
import type { Company } from '@/lib/types';

interface PublicLogoProps {
    company: Company | null;
    isLoading: boolean;
}

export function PublicLogo({ company, isLoading }: PublicLogoProps) {
  
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
