'use client';

import { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { useSharedSession } from '@/context/shared-session-provider';

export default function SharedDashboardPage() {
  const { session, isLoading: isSessionLoading } = useSharedSession();
  const firestore = useFirestore();

  const tasksQuery = useMemo(() => {
    if (!firestore || !session) return null;
    return query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
  }, [firestore, session]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  const isLoading = isSessionLoading || isTasksLoading;

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Dashboard" />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <KanbanBoard tasks={tasks || []} permissions={session?.permissions} />
        )}
      </main>
    </div>
  );
}
