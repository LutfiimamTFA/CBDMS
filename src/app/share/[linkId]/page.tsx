
'use client';

import { useMemo } from 'react';
import { notFound } from 'next/navigation';
import { useDoc, useFirestore } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { SharedLink, Task } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { useCollection } from '@/firebase/firestore/use-collection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SharedCalendarView } from '@/components/share/shared-calendar-view';

export default function SharedLinkPage({ params }: { params: { linkId: string } }) {
  const { linkId } = params;
  const firestore = useFirestore();

  const linkDocRef = useMemo(() => {
    if (!firestore) return null;
    return doc(firestore, 'sharedLinks', linkId);
  }, [firestore, linkId]);

  const { data: sharedLink, isLoading: isLinkLoading, error: linkError } = useDoc<SharedLink>(linkDocRef);

  const tasksQuery = useMemo(() => {
    if (!firestore || !sharedLink) return null;
    
    // Base query for the company
    let q = query(collection(firestore, 'tasks'), where('companyId', '==', sharedLink.companyId));

    // Add specific filters based on targetType
    switch (sharedLink.targetType) {
        case 'brand':
            q = query(q, where('brandId', '==', sharedLink.targetId));
            break;
        case 'priority':
            q = query(q, where('priority', '==', sharedLink.targetId));
            break;
        case 'assignee':
             q = query(q, where('assigneeIds', 'array-contains', sharedLink.targetId));
            break;
        case 'dashboard':
        default:
            // No additional filter needed for dashboard
            break;
    }
    return q;
  }, [firestore, sharedLink]);

  const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery, {
    disabled: !sharedLink,
  });

  const isLoading = isLinkLoading || areTasksLoading;

  // Handle expired link
  if (sharedLink?.expiresAt && new Date(sharedLink.expiresAt) < new Date()) {
    return (
        <div className="flex h-screen w-full items-center justify-center bg-background">
            <div className="text-center">
                <h1 className="text-2xl font-bold">Link Expired</h1>
                <p className="text-muted-foreground">This share link has expired and is no longer valid.</p>
            </div>
        </div>
    );
  }

  // Handle password protection - Simplified for this example
  if (sharedLink && sharedLink.password) {
      // In a real app, you'd have a proper password prompt page/state
      console.warn("This link is password protected. UI for password entry is not implemented in this version.");
  }


  if (!isLoading && (!sharedLink || linkError)) {
    return notFound();
  }
  
  if (isLoading && !tasks) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!sharedLink) {
    return notFound();
  }

  return (
    <div className="flex h-svh flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <h1 className="font-headline text-xl font-semibold md:text-2xl">{sharedLink.targetName || 'Shared View'}</h1>
         <span className="text-sm text-muted-foreground">Read-only view</span>
      </header>
      <main className="flex-1 flex flex-col overflow-hidden p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="board" className="flex flex-col flex-1">
            <TabsList className="mb-4">
              <TabsTrigger value="board">Board</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
            <TabsContent value="board" className="flex-1 overflow-hidden">
                <KanbanBoard tasks={tasks || []} permissions={sharedLink.permissions} />
            </TabsContent>
            <TabsContent value="calendar" className="flex-1 overflow-hidden">
                <SharedCalendarView tasks={tasks || []} permissions={sharedLink.permissions} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
