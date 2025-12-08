
'use client';

import { useMemo } from 'react';
import { notFound } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { SharedLink, Task } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { useCollection } from '@/firebase/firestore/use-collection';

export default function SharedLinkPage({ params }: { params: { linkId: string } }) {
  const { linkId } = params;
  const firestore = useFirestore();

  const linkDocRef = useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: sharedLink, isLoading: isLinkLoading, error } = useDoc<SharedLink>(linkDocRef);

  // TODO: Add password protection step if sharedLink.password exists

  // In a real scenario, you'd have more sophisticated logic based on sharedLink.targetType
  const tasksQuery = useMemo(() => {
    if (!firestore || !sharedLink) return null;

    // Currently only shares the full dashboard (all tasks for the company)
    return query(collection(firestore, 'tasks'), where('companyId', '==', sharedLink.companyId));
  }, [firestore, sharedLink]);

  const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
  
  const isLoading = isLinkLoading || areTasksLoading;

  if (!isLoading && (!sharedLink || error)) {
    return notFound();
  }
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!sharedLink) {
    return notFound();
  }

  // A read-only Kanban board for 'view' access level
  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <h1 className="font-headline text-xl font-semibold md:text-2xl">Shared View</h1>
      </header>
      <main className="flex-1 overflow-hidden p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <KanbanBoard tasks={tasks || []} />
        )}
      </main>
    </div>
  );
}

