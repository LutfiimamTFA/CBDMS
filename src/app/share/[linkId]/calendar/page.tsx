
'use client';

import React from 'react';
import { Header } from '@/components/layout/header';
import { useCollection, useFirestore, useSharedSession } from '@/firebase';
import type { Task } from '@/lib/types';
import { collection, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { notFound } from 'next/navigation';
import { SharedCalendarView } from '@/components/share/shared-calendar-view';

export default function SharedCalendarPage() {
  const { session, isLoading: isSessionLoading } = useSharedSession();
  const firestore = useFirestore();

  // Security check
  if (!isSessionLoading && session && !session.allowedNavItems.includes('nav_calendar')) {
    return notFound();
  }

  const tasksQuery = React.useMemo(() => {
    if (!firestore || !session) return null;
    return query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
  }, [firestore, session]);
  
  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);
  const isLoading = isSessionLoading || isTasksLoading;

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Calendar" />
      <main className="flex flex-col flex-1 p-4 md:p-6 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <SharedCalendarView tasks={tasks || []} permissions={session?.permissions} />
        )}
      </main>
    </div>
  );
}
