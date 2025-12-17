'use client';

import { useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Task, SharedLink } from '@/lib/types';
import { Loader2 } from 'lucide-react';

interface SharedDashboardViewProps {
  permissions: SharedLink['permissions'];
  companyId: string;
}

export function SharedDashboardView({ permissions, companyId }: SharedDashboardViewProps) {
  const firestore = useFirestore();

  const tasksQuery = useMemo(() => {
    if (!firestore || !companyId) return null;
    return query(collection(firestore, 'tasks'), where('companyId', '==', companyId));
  }, [firestore, companyId]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  return (
    <div className="flex h-svh flex-col bg-background">
      <Header title="Dashboard" />
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        {isTasksLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <KanbanBoard tasks={tasks || []} permissions={permissions} />
        )}
      </main>
    </div>
  );
}
