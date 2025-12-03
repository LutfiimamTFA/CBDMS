
'use client';

import { useState, useEffect, useMemo } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, WorkflowStatus } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useCollection, useFirestore, useUserProfile } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
}

export function KanbanBoard({ tasks: initialTasks }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const firestore = useFirestore();
  const { profile } = useUserProfile();

  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const statusesQuery = useMemo(
    () =>
      firestore && profile
        ? query(collection(firestore, 'statuses'), orderBy('order'))
        : null,
    [firestore, profile]
  );

  const { data: statuses, isLoading: areStatusesLoading } =
    useCollection<WorkflowStatus>(statusesQuery);

  if (areStatusesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex h-full gap-4 pb-4">
        {statuses?.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasks.filter((task) => task.status === status.name)}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
