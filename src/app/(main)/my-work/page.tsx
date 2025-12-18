
'use client';

import React, { useMemo } from 'react';
import { useUserProfile, useCollection, useFirestore } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { ActionItems } from '@/components/my-work/action-items';
import { TodaysFocus } from '@/components/my-work/todays-focus';
import { DailyChecklist } from '@/components/my-work/daily-checklist';

export default function MyWorkPage() {
  const { profile, isLoading: isProfileLoading, user } = useUserProfile();
  
  if (isProfileLoading || !profile) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
        <main className="flex-1 overflow-auto p-4 md:p-6">
            <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">My Work</h2>
                <p className="text-muted-foreground">
                    Your personal dashboard to track tasks and stay productive.
                </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                   <TodaysFocus />
                </div>
                <div className="space-y-8">
                    <ActionItems />
                    <DailyChecklist />
                </div>
            </div>
        </main>
    </div>
  );
}
