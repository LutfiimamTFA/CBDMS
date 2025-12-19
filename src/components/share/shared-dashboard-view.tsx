
'use client';
import type { Task, SharedLink, WorkflowStatus, Brand, User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { SharedKanbanBoard } from './shared-kanban-board';

interface SharedDashboardViewProps {
  session: SharedLink;
  tasks: Task[] | null;
  statuses: WorkflowStatus[] | null;
  isLoading: boolean;
}

export function SharedDashboardView({ session, tasks, statuses, isLoading }: SharedDashboardViewProps) {
  return (
    <div className="flex flex-col flex-1 h-full w-full">
      <main className="flex-1 overflow-auto p-4 md:p-6">
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <SharedKanbanBoard
            initialTasks={tasks || []}
            statuses={statuses || []}
            accessLevel={session.accessLevel}
            linkId={session.id}
            creatorRole={session.creatorRole}
          />
        )}
      </main>
    </div>
  );
}
