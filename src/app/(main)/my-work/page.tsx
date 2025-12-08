'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { useUserProfile } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { ActionItems } from '@/components/my-work/action-items';
import { TodaysFocus } from '@/components/my-work/todays-focus';

export default function MyWorkPage() {
  const { profile, isLoading } = useUserProfile();

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="My Work" />
      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight">
            Welcome, {profile?.name}!
          </h2>
          <p className="text-muted-foreground">
            Here's what's on your plate. Let's make it a productive day.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="space-y-6">
                <ActionItems />
            </div>
            <div className="space-y-6">
                <TodaysFocus />
            </div>
        </div>
      </main>
    </div>
  );
}
