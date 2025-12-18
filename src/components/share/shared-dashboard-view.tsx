
'use client';
import { useMemo } from 'react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import type { Task, SharedLink } from '@/lib/types';
import { SharedHeader } from './shared-header';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, where, type Query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface SharedDashboardViewProps {
  session: SharedLink;
}

export function SharedDashboardView({ session }: SharedDashboardViewProps) {
  const firestore = useFirestore();

  const tasksQuery = useMemo(() => {
    if (!firestore || !session.companyId) return null;
    
    let q: Query = query(collection(firestore, 'tasks'), where('companyId', '==', session.companyId));
    
    // This is the critical security filter.
    // If the link is scoped to specific brands, we MUST filter by them.
    if (session.brandIds && session.brandIds.length > 0) {
      q = query(q, where('brandId', 'in', session.brandIds));
    }
    
    return q;
  }, [firestore, session]);

  const { data: tasks, isLoading: isTasksLoading } = useCollection<Task>(tasksQuery);

  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <SharedHeader title="Task Board" />
      <main className="flex-1 overflow-hidden p-4 md:p-6 w-full">
        {isTasksLoading ? (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        ) : (
            <KanbanBoard tasks={tasks || []} permissions={session.permissions} isSharedView={true} linkId={session.id} />
        )}
      </main>
    </div>
  );
}
