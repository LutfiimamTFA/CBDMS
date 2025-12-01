
'use client';

import { useState, useEffect } from 'react';
import { KanbanColumn } from './kanban-column';
import type { Task, Status } from '@/lib/types';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const statuses: Status[] = ['To Do', 'Doing', 'Done'];

interface KanbanBoardProps {
  tasks: Task[];
}

export function KanbanBoard({ tasks }: KanbanBoardProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Render a skeleton or placeholder on the server to avoid hydration mismatches
    return (
      <div className="flex h-full gap-4">
        {statuses.map(status => (
          <div key={status} className="flex-1 h-full rounded-lg bg-secondary/50">
             <div className="p-4 h-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex h-full gap-4 pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={(tasks || []).filter((task) => task.status === status)}
          />
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
