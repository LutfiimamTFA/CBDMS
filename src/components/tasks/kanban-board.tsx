'use client';

import { useState, useEffect } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, Status } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirebase, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc } from 'firebase/firestore';

const statuses: Status[] = ['To Do', 'Doing', 'Done'];

export function KanbanBoard() {
  const { firestore, user } = useFirebase();

  const tasksQuery = useMemoFirebase(() => {
    if (!user) return null;
    // In a real RBAC app, this query would change based on the user's role.
    // For now, we fetch all tasks and rely on Firestore rules for security.
    // A Manager might query for all tasks in their company, an Employee for assigned tasks.
    return collection(firestore, 'tasks');
  }, [firestore, user]);

  const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newStatus: Status) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (!user || !taskId) return;
    
    const taskRef = doc(firestore, 'tasks', taskId);
    updateDoc(taskRef, { status: newStatus }).catch(err => console.error(err));
  };

  if (!isClient || isLoading) {
    return (
       <div className="grid h-full auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4 p-4 md:p-6">
        {statuses.map(status => (
          <div key={status} className="flex h-full flex-col rounded-lg bg-secondary/50">
             <div className="p-4 h-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="grid h-full auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={(tasks || []).filter((task) => task.status === status)}
            onDrop={handleDrop}
            onDragStart={handleDragStart}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

    