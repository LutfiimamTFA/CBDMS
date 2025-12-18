
'use client';
import { useMemo } from 'react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import type { Task, SharedLink } from '@/lib/types';
import { SharedHeader } from './shared-header';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface SharedDashboardViewProps {
  session: SharedLink;
}

export function SharedDashboardView({ session }: SharedDashboardViewProps) {
  const firestore = useFirestore();

  const tasksQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    return query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
  }, [firestore, session.companyId]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  if (isTasksLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <SharedHeader title="Task Board" />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        <KanbanBoard tasks={tasks || []} permissions={session.permissions} isSharedView={true} linkId={session.id} />
      </main>
    </div>
  );
}
